from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.config import get_settings  # noqa: E402
from app.services.ingest import build_database  # noqa: E402


def main() -> None:
    settings = get_settings()
    stats = build_database(settings.raw_data_dir, settings.sample_csv_path, settings.database_path)
    print(
        "Built {db} from {files} file(s), {rows} row(s), version {version}".format(
            db=stats.database_path,
            files=stats.source_files,
            rows=stats.rows,
            version=stats.data_version,
        )
    )


if __name__ == "__main__":
    main()
