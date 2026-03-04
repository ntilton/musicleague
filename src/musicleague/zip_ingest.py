from __future__ import annotations

from pathlib import Path
import zipfile

import pandas as pd


def extract_zip_files(
    zip_directory: str | Path,
    output_directory: str | Path,
    separator: str = "__",
    overwrite: bool = True,
) -> list[Path]:
    zip_directory = Path(zip_directory)
    output_directory = Path(output_directory)
    output_directory.mkdir(parents=True, exist_ok=True)

    extracted_paths: list[Path] = []
    for zip_path in sorted(zip_directory.glob("*.zip")):
        zip_stem = zip_path.stem
        with zipfile.ZipFile(zip_path, "r") as archive:
            for member in archive.infolist():
                if member.is_dir():
                    continue

                original_name = Path(member.filename).name
                if not original_name:
                    continue

                candidate_name = f"{zip_stem}{separator}{original_name}"
                destination = output_directory / candidate_name
                if not overwrite:
                    destination = _ensure_unique_path(destination)

                with archive.open(member) as source, destination.open("wb") as target:
                    target.write(source.read())

                extracted_paths.append(destination)

    return extracted_paths


def build_file_inventory_dataframe(extracted_paths: list[Path], separator: str = "__") -> pd.DataFrame:
    rows: list[dict[str, str]] = []
    for file_path in extracted_paths:
        source_zip, original_name = _split_prefixed_name(file_path.name, separator=separator)
        suffix = file_path.suffix.lower()
        file_type = suffix[1:] if suffix else "no_extension"

        rows.append(
            {
                "source_zip": source_zip,
                "original_name": original_name,
                "renamed_name": file_path.name,
                "file_type": file_type,
                "path": str(file_path),
            }
        )

    return pd.DataFrame(rows)


def load_dataframes_by_file_type(extracted_paths: list[Path], separator: str = "__") -> dict[str, pd.DataFrame]:
    grouped_frames: dict[str, list[pd.DataFrame]] = {}

    for file_path in extracted_paths:
        suffix = file_path.suffix.lower()
        file_type = suffix[1:] if suffix else "no_extension"

        frame = _read_file_to_dataframe(file_path)
        if frame is None:
            continue

        source_zip, original_name = _split_prefixed_name(file_path.name, separator=separator)
        frame.insert(0, "source_zip", source_zip)
        frame.insert(1, "source_file", original_name)
        frame.insert(2, "source_path", str(file_path))

        grouped_frames.setdefault(file_type, []).append(frame)

    return {
        file_type: pd.concat(frames, ignore_index=True)
        for file_type, frames in grouped_frames.items()
    }


def extract_and_load_by_type(
    zip_directory: str | Path,
    output_directory: str | Path,
    separator: str = "__",
    overwrite: bool = True,
) -> tuple[pd.DataFrame, dict[str, pd.DataFrame]]:
    extracted_paths = extract_zip_files(
        zip_directory=zip_directory,
        output_directory=output_directory,
        separator=separator,
        overwrite=overwrite,
    )
    inventory = build_file_inventory_dataframe(extracted_paths, separator=separator)
    frames_by_type = load_dataframes_by_file_type(extracted_paths, separator=separator)
    return inventory, frames_by_type


def _ensure_unique_path(destination: Path) -> Path:
    if not destination.exists():
        return destination

    stem = destination.stem
    suffix = destination.suffix
    parent = destination.parent

    counter = 1
    while True:
        candidate = parent / f"{stem}_{counter}{suffix}"
        if not candidate.exists():
            return candidate
        counter += 1


def _split_prefixed_name(file_name: str, separator: str = "__") -> tuple[str, str]:
    if separator in file_name:
        source_zip, original_name = file_name.split(separator, 1)
        return source_zip, original_name

    return "unknown", file_name


def _read_file_to_dataframe(file_path: Path) -> pd.DataFrame | None:
    suffix = file_path.suffix.lower()

    if suffix == ".csv":
        return pd.read_csv(file_path)

    if suffix == ".tsv":
        return pd.read_csv(file_path, sep="\t")

    if suffix in {".json", ".jsonl"}:
        if suffix == ".jsonl":
            return pd.read_json(file_path, lines=True)

        try:
            return pd.read_json(file_path)
        except ValueError:
            return pd.read_json(file_path, lines=True)

    if suffix in {".parquet", ".pq"}:
        return pd.read_parquet(file_path)

    if suffix in {".xlsx", ".xls"}:
        return pd.read_excel(file_path)

    return None