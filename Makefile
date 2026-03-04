.PHONY: setup test run analyze playlist dashboard dashboard-package dashboard-single-file

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

dashboard:
	/home/neil/dev/musicleague/.venv/bin/python -m http.server $${PORT:-8001}

dashboard-package:
	rm -rf dist/dashboard-share dist/dashboard-share.zip
	mkdir -p dist/dashboard-share/dashboard dist/dashboard-share/data/processed
	cp dashboard/index.html dashboard/app.js dashboard/styles.css dist/dashboard-share/dashboard/
	cp data/processed/submissions_enriched.csv dist/dashboard-share/data/processed/
	/home/neil/dev/musicleague/.venv/bin/python scripts/build_dashboard_single_file.py
	cp dist/dashboard-single-file.html dist/dashboard-share/
	cd dist && zip -r dashboard-share.zip dashboard-share >/dev/null
	@echo "Created dist/dashboard-share/ and dist/dashboard-share.zip"

dashboard-single-file:
	/home/neil/dev/musicleague/.venv/bin/python scripts/build_dashboard_single_file.py
