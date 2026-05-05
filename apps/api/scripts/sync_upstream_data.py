from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.config import get_settings  # noqa: E402

REPO = "scc2450/CourseInquiry"
TREE_URL = "https://api.github.com/repos/{repo}/git/trees/main?recursive=1"
RAW_URL = "https://raw.githubusercontent.com/{repo}/main/{path}"


def _download_json(url: str) -> dict:
    request = Request(url, headers={"User-Agent": "course-inquiry-modern-sync"})
    with urlopen(request) as response:
        return json.loads(response.read().decode("utf-8"))


def _download_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": "course-inquiry-modern-sync"})
    with urlopen(request) as response:
        return response.read().decode("utf-8-sig")


def main() -> None:
    settings = get_settings()
    tree = _download_json(TREE_URL.format(repo=REPO))
    csv_paths = [
        item["path"]
        for item in tree.get("tree", [])
        if item.get("type") == "blob" and item.get("path", "").startswith("file/") and item["path"].endswith(".csv")
    ]
    if not csv_paths:
        raise SystemExit("No CSV files found in upstream repository.")

    target_root = settings.raw_data_dir
    target_root.mkdir(parents=True, exist_ok=True)
    for index, path in enumerate(csv_paths, start=1):
        relative = Path(path).relative_to("file")
        target = target_root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(_download_text(RAW_URL.format(repo=REPO, path=path)), encoding="utf-8")
        print("[{}/{}] {}".format(index, len(csv_paths), target))

    print("Downloaded {} CSV file(s) into {}".format(len(csv_paths), target_root))


if __name__ == "__main__":
    main()
