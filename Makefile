.PHONY: setup test run analyze playlist

setup:
	/home/neil/dev/musicleague/.venv/bin/python -m pip install --upgrade pip
	/home/neil/dev/musicleague/.venv/bin/python -m pip install -e . pytest

test:
	/home/neil/dev/musicleague/.venv/bin/python -m pytest -q

run:
	/home/neil/dev/musicleague/.venv/bin/python -m musicleague.main

analyze:
	/home/neil/dev/musicleague/.venv/bin/python scripts/run_ingest_analysis.py

playlist:
	/home/neil/dev/musicleague/.venv/bin/python scripts/create_spotify_playlist.py --name "$${PLAYLIST_NAME:-MusicLeague Export}"
