from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from musicleague import extract_and_load_by_type


TARGET_TABLES = ("votes", "rounds", "submissions", "competitors")
ENRICHED_SUBMISSIONS_FILE = "submissions_enriched.csv"


def combine_frames_by_type(frames_by_type: dict[str, pd.DataFrame]) -> pd.DataFrame:
    combined_frames: list[pd.DataFrame] = []

    for file_type, frame in frames_by_type.items():
        frame_with_type = frame.copy()
        frame_with_type.insert(0, "file_type", file_type)
        combined_frames.append(frame_with_type)

    if not combined_frames:
        return pd.DataFrame()

    return pd.concat(combined_frames, ignore_index=True, sort=False)


def split_into_target_tables(
    combined: pd.DataFrame,
    target_tables: tuple[str, ...] = TARGET_TABLES,
) -> dict[str, pd.DataFrame]:
    outputs: dict[str, pd.DataFrame] = {}

    if combined.empty or "source_file" not in combined.columns:
        for table_name in target_tables:
            outputs[table_name] = pd.DataFrame()
        return outputs

    source_file_series = combined["source_file"].astype(str).str.lower()
    for table_name in target_tables:
        mask = source_file_series == f"{table_name}.csv"
        outputs[table_name] = combined.loc[mask].copy()

    return outputs


def join_competitors_to_submissions(
    competitors: pd.DataFrame,
    submissions: pd.DataFrame,
) -> pd.DataFrame:
    if submissions.empty:
        return submissions.copy()

    required_competitor_columns = {"ID", "Name"}
    missing_competitor_columns = required_competitor_columns.difference(competitors.columns)
    if missing_competitor_columns:
        raise ValueError(
            f"competitors dataframe is missing required columns: {sorted(missing_competitor_columns)}"
        )

    if "Submitter ID" not in submissions.columns:
        raise ValueError("submissions dataframe is missing required column: ['Submitter ID']")

    distinct_competitors = (
        competitors.loc[:, ["ID", "Name"]]
        .dropna(subset=["ID"])
        .drop_duplicates(subset=["ID", "Name"])
    )

    return submissions.merge(
        distinct_competitors,
        how="left",
        left_on="Submitter ID",
        right_on="ID",
        suffixes=("", "_competitor"),
    )


def aggregate_votes(votes: pd.DataFrame) -> pd.DataFrame:
    required_columns = {"Spotify URI", "Round ID", "Points Assigned"}
    missing_columns = required_columns.difference(votes.columns)
    if missing_columns:
        raise ValueError(f"votes dataframe is missing required columns: {sorted(missing_columns)}")

    if votes.empty:
        return pd.DataFrame(columns=["Spotify URI", "Round ID", "Total Points Assigned"])

    grouped_votes = votes.loc[:, ["Spotify URI", "Round ID", "Points Assigned"]].copy()
    grouped_votes["Points Assigned"] = pd.to_numeric(grouped_votes["Points Assigned"], errors="coerce").fillna(0)

    return (
        grouped_votes.groupby(["Spotify URI", "Round ID"], as_index=False)["Points Assigned"]
        .sum()
        .rename(columns={"Points Assigned": "Total Points Assigned"})
    )


def join_votes_to_submissions(
    submissions_with_competitors: pd.DataFrame,
    aggregated_votes: pd.DataFrame,
) -> pd.DataFrame:
    if submissions_with_competitors.empty:
        return submissions_with_competitors.copy()

    required_submission_columns = {"Spotify URI", "Round ID"}
    missing_submission_columns = required_submission_columns.difference(submissions_with_competitors.columns)
    if missing_submission_columns:
        raise ValueError(
            f"submissions dataframe is missing required columns: {sorted(missing_submission_columns)}"
        )

    return submissions_with_competitors.merge(
        aggregated_votes,
        how="left",
        on=["Spotify URI", "Round ID"],
    )


def join_rounds_name_to_submissions(
    submissions_enriched: pd.DataFrame,
    rounds: pd.DataFrame,
) -> pd.DataFrame:
    if submissions_enriched.empty:
        return submissions_enriched.copy()

    required_round_columns = {"ID", "Name"}
    missing_round_columns = required_round_columns.difference(rounds.columns)
    if missing_round_columns:
        raise ValueError(f"rounds dataframe is missing required columns: {sorted(missing_round_columns)}")

    if "Round ID" not in submissions_enriched.columns:
        raise ValueError("submissions dataframe is missing required column: ['Round ID']")

    distinct_rounds = (
        rounds.loc[:, ["ID", "Name"]]
        .dropna(subset=["ID"])
        .drop_duplicates(subset=["ID", "Name"])
        .rename(columns={"ID": "Round ID", "Name": "Round Name"})
    )

    return submissions_enriched.merge(
        distinct_rounds,
        how="left",
        on="Round ID",
    )


def write_target_tables(processed_dir: Path, outputs: dict[str, pd.DataFrame]) -> dict[str, Path]:
    written_paths: dict[str, Path] = {}
    for table_name, frame in outputs.items():
        output_path = processed_dir / f"{table_name}.csv"
        cleaned_frame = drop_fully_missing_columns(frame)
        cleaned_frame.to_csv(output_path, index=False)
        written_paths[table_name] = output_path
    return written_paths


def write_dataframe(processed_dir: Path, file_name: str, frame: pd.DataFrame) -> Path:
    output_path = processed_dir / file_name
    cleaned_frame = drop_fully_missing_columns(frame)
    cleaned_frame.to_csv(output_path, index=False)
    return output_path


def drop_fully_missing_columns(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.empty:
        return frame.copy()

    keep_columns: list[str] = []
    for column in frame.columns:
        series = frame[column]
        if pd.api.types.is_string_dtype(series) or pd.api.types.is_object_dtype(series):
            normalized = series.replace(r"^\s*$", pd.NA, regex=True)
            if not normalized.isna().all():
                keep_columns.append(column)
            continue

        if not series.isna().all():
            keep_columns.append(column)

    return frame.loc[:, keep_columns].copy()


def remove_legacy_outputs(processed_dir: Path) -> None:
    for legacy_file in (
        "inventory.csv",
        "combined.csv",
        "summary.csv",
        "submissions_with_competitors.csv",
    ):
        legacy_path = processed_dir / legacy_file
        if legacy_path.exists():
            legacy_path.unlink()


def run_pipeline(
    raw_dir: Path,
    extracted_dir: Path,
    processed_dir: Path,
    separator: str = "__",
    overwrite: bool = True,
) -> None:
    raw_dir = _resolve_raw_dir(raw_dir)
    zip_count = len(list(raw_dir.glob("*.zip")))

    extracted_dir.mkdir(parents=True, exist_ok=True)
    processed_dir.mkdir(parents=True, exist_ok=True)

    print(f"Using raw dir: {raw_dir}")
    print(f"Using extracted dir: {extracted_dir}")
    print(f"Using processed dir: {processed_dir}")
    print(f"Zip files found: {zip_count}")

    if zip_count == 0:
        print("No zip files found. Add .zip files to the raw directory and run again.")
        return

    _, frames_by_type = extract_and_load_by_type(
        zip_directory=raw_dir,
        output_directory=extracted_dir,
        separator=separator,
        overwrite=overwrite,
    )

    combined = combine_frames_by_type(frames_by_type)
    outputs = split_into_target_tables(combined)
    submissions_with_competitors = join_competitors_to_submissions(
        competitors=outputs["competitors"],
        submissions=outputs["submissions"],
    )
    aggregated_votes = aggregate_votes(outputs["votes"])
    enriched_submissions = join_votes_to_submissions(
        submissions_with_competitors=submissions_with_competitors,
        aggregated_votes=aggregated_votes,
    )
    enriched_submissions = join_rounds_name_to_submissions(
        submissions_enriched=enriched_submissions,
        rounds=outputs["rounds"],
    )
    written_paths = write_target_tables(processed_dir, outputs)
    joined_submissions_path = write_dataframe(
        processed_dir=processed_dir,
        file_name=ENRICHED_SUBMISSIONS_FILE,
        frame=enriched_submissions,
    )
    remove_legacy_outputs(processed_dir)

    print(f"Combined rows across all loaded files: {len(combined)}")
    for table_name in TARGET_TABLES:
        print(f"Rows in {table_name}.csv: {len(outputs[table_name])}")
    print(f"Rows in {ENRICHED_SUBMISSIONS_FILE}: {len(enriched_submissions)}")
    print(f"File types loaded: {sorted(frames_by_type.keys())}")
    for table_name in TARGET_TABLES:
        print(f"Wrote: {written_paths[table_name]}")
    print(f"Wrote: {joined_submissions_path}")


def _resolve_raw_dir(requested_raw_dir: Path) -> Path:
    if requested_raw_dir.exists():
        return requested_raw_dir

    fallback = Path("src/musicleague/data/raw")
    if fallback.exists():
        print(f"Raw dir '{requested_raw_dir}' not found. Falling back to '{fallback}'.")
        return fallback

    return requested_raw_dir


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract zip files and run a basic analysis pipeline.")
    parser.add_argument("--raw-dir", default="data/raw", help="Directory containing .zip files")
    parser.add_argument("--extracted-dir", default="data/extracted", help="Directory for extracted renamed files")
    parser.add_argument("--processed-dir", default="data/processed", help="Directory for analysis outputs")
    parser.add_argument("--separator", default="__", help="Separator used in renamed extracted files")
    parser.add_argument("--overwrite", action="store_true", dest="overwrite", help="Overwrite extracted files if they already exist")
    parser.add_argument("--no-overwrite", action="store_false", dest="overwrite", help="Keep existing extracted files and write new files with suffixes")
    parser.set_defaults(overwrite=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    run_pipeline(
        raw_dir=Path(args.raw_dir),
        extracted_dir=Path(args.extracted_dir),
        processed_dir=Path(args.processed_dir),
        separator=args.separator,
        overwrite=args.overwrite,
    )


if __name__ == "__main__":
    main()
