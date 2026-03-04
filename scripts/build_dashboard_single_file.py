from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = ROOT / "dashboard" / "index.html"
STYLES_PATH = ROOT / "dashboard" / "styles.css"
APP_PATH = ROOT / "dashboard" / "app.js"
CSV_PATH = ROOT / "data" / "processed" / "submissions_enriched.csv"
OUTPUT_PATH = ROOT / "dist" / "dashboard-single-file.html"


def load_csv_rows(csv_path: Path) -> list[dict[str, str]]:
    with csv_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader)


def build_single_file_html(index_html: str, styles: str, app_js: str, rows: list[dict[str, str]]) -> str:
    html = index_html

    html = html.replace(
        '<link rel="stylesheet" href="styles.css" />',
        f"<style>\n{styles}\n</style>",
    )

    html = html.replace(
        '<script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>\n',
        "",
    )

    inline_script = (
        "<script>\n"
        f"window.__SUBMISSIONS_DATA__ = {json.dumps(rows, ensure_ascii=False)};\n"
        "</script>\n"
        "<script>\n"
        f"{app_js}\n"
        "</script>"
    )

    html = html.replace('<script src="app.js?v=2"></script>', inline_script)

    return html


def main() -> None:
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"Missing input CSV: {CSV_PATH}")

    index_html = INDEX_PATH.read_text(encoding="utf-8")
    styles = STYLES_PATH.read_text(encoding="utf-8")
    app_js = APP_PATH.read_text(encoding="utf-8")
    rows = load_csv_rows(CSV_PATH)

    output_html = build_single_file_html(index_html=index_html, styles=styles, app_js=app_js, rows=rows)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(output_html, encoding="utf-8")

    print(f"Created: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
