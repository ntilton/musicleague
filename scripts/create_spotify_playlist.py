from __future__ import annotations

import argparse
from datetime import date
import os
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
import pandas as pd
import spotipy
from spotipy.oauth2 import SpotifyOAuth


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a Spotify playlist from a processed CSV.")
    parser.add_argument(
        "--input-csv",
        default="data/processed/submissions_enriched.csv",
        help="Path to CSV containing track references",
    )
    parser.add_argument(
        "--uri-column",
        default="Spotify URI",
        help="Primary column containing Spotify track URIs",
    )
    parser.add_argument(
        "--name",
        default=f"MusicLeague Export {date.today().isoformat()}",
        help="Playlist name",
    )
    parser.add_argument(
        "--description",
        default="Generated from MusicLeague submissions_enriched.csv",
        help="Playlist description",
    )
    parser.add_argument(
        "--public",
        action="store_true",
        help="Create a public playlist (default is private)",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=None,
        help="Optional number of top tracks by Total Points Assigned",
    )
    parser.add_argument(
        "--no-sort-by-points",
        action="store_true",
        help="Keep file order instead of sorting by Total Points Assigned",
    )
    return parser.parse_args()


def ensure_env() -> None:
    required = [
        "SPOTIPY_CLIENT_ID",
        "SPOTIPY_CLIENT_SECRET",
        "SPOTIPY_REDIRECT_URI",
    ]
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        raise RuntimeError(f"Missing required environment variables: {missing}")


def normalize_track_uri(value: object) -> str | None:
    if value is None:
        return None

    text = str(value).strip()
    if not text:
        return None

    if text.startswith("spotify:track:"):
        return text

    if "open.spotify.com/track/" in text:
        parsed = urlparse(text)
        path_parts = [part for part in parsed.path.split("/") if part]
        if len(path_parts) >= 2 and path_parts[0] == "track":
            return f"spotify:track:{path_parts[1]}"

    return None


def build_track_uris(
    df: pd.DataFrame,
    uri_column: str,
    sort_by_points: bool,
    top_n: int | None,
) -> list[str]:
    working = df.copy()

    if sort_by_points and "Total Points Assigned" in working.columns:
        working["Total Points Assigned"] = pd.to_numeric(
            working["Total Points Assigned"],
            errors="coerce",
        ).fillna(0)
        working = working.sort_values(by="Total Points Assigned", ascending=False)

    source_columns = [col for col in [uri_column, "Playlist URL"] if col in working.columns]
    if not source_columns:
        raise RuntimeError(
            f"Could not find '{uri_column}' or 'Playlist URL' in input CSV columns: {list(working.columns)}"
        )

    uris: list[str] = []
    seen: set[str] = set()

    for _, row in working.iterrows():
        uri: str | None = None
        for column in source_columns:
            uri = normalize_track_uri(row.get(column))
            if uri:
                break

        if not uri or uri in seen:
            continue

        seen.add(uri)
        uris.append(uri)

        if top_n is not None and len(uris) >= top_n:
            break

    return uris


def chunked(values: list[str], chunk_size: int) -> list[list[str]]:
    return [values[index:index + chunk_size] for index in range(0, len(values), chunk_size)]


def create_playlist(track_uris: list[str], playlist_name: str, description: str, is_public: bool) -> str:
    sp = spotipy.Spotify(
        auth_manager=SpotifyOAuth(
            scope="playlist-modify-private playlist-modify-public",
        )
    )

    user_id = sp.current_user()["id"]
    playlist = sp.user_playlist_create(
        user=user_id,
        name=playlist_name,
        public=is_public,
        description=description,
    )

    for batch in chunked(track_uris, 100):
        sp.playlist_add_items(playlist_id=playlist["id"], items=batch)

    return playlist["external_urls"]["spotify"]


def main() -> None:
    load_dotenv()
    ensure_env()

    args = parse_args()
    input_path = Path(args.input_csv)
    if not input_path.exists():
        raise FileNotFoundError(f"Input CSV not found: {input_path}")

    df = pd.read_csv(input_path)
    uris = build_track_uris(
        df=df,
        uri_column=args.uri_column,
        sort_by_points=not args.no_sort_by_points,
        top_n=args.top,
    )

    if not uris:
        raise RuntimeError("No valid Spotify track URIs found in input CSV")

    playlist_url = create_playlist(
        track_uris=uris,
        playlist_name=args.name,
        description=args.description,
        is_public=args.public,
    )

    print(f"Tracks added: {len(uris)}")
    print(f"Playlist URL: {playlist_url}")


if __name__ == "__main__":
    main()
