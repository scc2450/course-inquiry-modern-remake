from __future__ import annotations

import csv
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator, List, Optional


COURSE_COLUMNS = [
    "class_no",
    "course_id",
    "course_name",
    "course_type",
    "credits",
    "remark",
    "schedule_time",
    "schedule_week",
    "teacher",
    "url",
    "academic_year",
    "term",
    "schedule_type",
    "department_id",
    "source_file",
]


@dataclass
class ImportStats:
    database_path: Path
    source_files: int
    rows: int
    data_version: str


def discover_csv_files(raw_data_dir: Path, sample_csv_path: Path) -> List[Path]:
    csv_files = sorted(raw_data_dir.glob("*/*.csv")) if raw_data_dir.exists() else []
    if csv_files:
        return csv_files
    return [sample_csv_path]


def _as_float(value: str) -> Optional[float]:
    if value is None:
        return None
    stripped = str(value).strip()
    if not stripped:
        return None
    try:
        return float(stripped)
    except ValueError:
        return None


def _text(row: dict, key: str) -> str:
    value = row.get(key, "")
    return "" if value is None else str(value).strip()


def iter_courses(csv_files: Iterable[Path]) -> Iterator[dict]:
    for csv_path in csv_files:
        with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                yield {
                    "class_no": _text(row, "classNo"),
                    "course_id": _text(row, "courseId"),
                    "course_name": _text(row, "courseName"),
                    "course_type": _text(row, "courseType"),
                    "credits": _as_float(_text(row, "credits")),
                    "remark": _text(row, "remark"),
                    "schedule_time": _text(row, "scheduleTime"),
                    "schedule_week": _text(row, "scheduleWeek"),
                    "teacher": _text(row, "teacher"),
                    "url": _text(row, "url"),
                    "academic_year": _text(row, "学年"),
                    "term": _text(row, "学期"),
                    "schedule_type": _text(row, "课表类型"),
                    "department_id": _text(row, "开课系所"),
                    "source_file": str(csv_path),
                }


def build_database(raw_data_dir: Path, sample_csv_path: Path, database_path: Path) -> ImportStats:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    csv_files = discover_csv_files(raw_data_dir, sample_csv_path)
    data_version = max(path.stat().st_mtime for path in csv_files) if csv_files else 0

    with sqlite3.connect(database_path) as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("DROP TABLE IF EXISTS courses")
        conn.execute(
            """
            CREATE TABLE courses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                class_no TEXT NOT NULL,
                course_id TEXT NOT NULL,
                course_name TEXT NOT NULL,
                course_type TEXT NOT NULL,
                credits REAL,
                remark TEXT NOT NULL,
                schedule_time TEXT NOT NULL,
                schedule_week TEXT NOT NULL,
                teacher TEXT NOT NULL,
                url TEXT NOT NULL,
                academic_year TEXT NOT NULL,
                term TEXT NOT NULL,
                schedule_type TEXT NOT NULL,
                department_id TEXT NOT NULL,
                source_file TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            """
        )
        conn.execute("DELETE FROM metadata")

        rows = 0
        insert_sql = "INSERT INTO courses ({}) VALUES ({})".format(
            ", ".join(COURSE_COLUMNS),
            ", ".join(["?"] * len(COURSE_COLUMNS)),
        )
        batch = []
        for course in iter_courses(csv_files):
            batch.append(tuple(course[column] for column in COURSE_COLUMNS))
            rows += 1
            if len(batch) >= 1000:
                conn.executemany(insert_sql, batch)
                batch = []
        if batch:
            conn.executemany(insert_sql, batch)

        conn.execute("CREATE INDEX idx_courses_term ON courses (schedule_type, academic_year, term)")
        conn.execute("CREATE INDEX idx_courses_dept ON courses (department_id)")
        conn.execute("CREATE INDEX idx_courses_type ON courses (course_type)")
        conn.execute("CREATE INDEX idx_courses_name ON courses (course_name)")
        conn.execute(
            "INSERT INTO metadata (key, value) VALUES (?, ?)",
            ("data_version", str(int(data_version))),
        )
        conn.execute(
            "INSERT INTO metadata (key, value) VALUES (?, ?)",
            ("row_count", str(rows)),
        )
        conn.commit()

    return ImportStats(
        database_path=database_path,
        source_files=len(csv_files),
        rows=rows,
        data_version=str(int(data_version)),
    )
