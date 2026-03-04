# musicleague

## Setup

```bash
git clone <your-repo-url>
cd musicleague
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e . pytest
```

## Run tests

```bash
python -m pytest -q
```

## Run ingest + analysis

```bash
make analyze
```

Defaults:
- `data/raw` for input zip files
- `data/extracted` for extracted/renamed files
- `data/processed` for output CSVs (`votes.csv`, `rounds.csv`, `submissions.csv`, `competitors.csv`, `submissions_enriched.csv`)

## Create a Spotify playlist

Set these in `.env` first:
- `SPOTIPY_CLIENT_ID`
- `SPOTIPY_CLIENT_SECRET`
- `SPOTIPY_REDIRECT_URI` (for example `http://127.0.0.1:8888/callback`)

Run:

```bash
make playlist
```

Optional custom playlist name:

```bash
PLAYLIST_NAME="MusicLeague Top Tracks" make playlist
```

## Notes

- This project uses a `src/` layout.
- Install with `-e` (editable mode) so imports like `musicleague` work during development.
