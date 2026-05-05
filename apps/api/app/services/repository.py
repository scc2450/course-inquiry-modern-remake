from __future__ import annotations

import csv
import io
import sqlite3
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

from ..config import Settings
from ..models import CourseItem, CourseSearchParams, CourseSearchResponse, MetaResponse, Option
from .ingest import build_database


FIELD_MAP = {
    "class_no": "classNo",
    "course_id": "courseId",
    "course_name": "courseName",
    "course_type": "courseType",
    "credits": "credits",
    "remark": "remark",
    "schedule_time": "scheduleTime",
    "schedule_week": "scheduleWeek",
    "teacher": "teacher",
    "url": "url",
    "academic_year": "academicYear",
    "term": "term",
    "schedule_type": "scheduleType",
    "department_id": "departmentId",
}

COURSE_SELECT = ", ".join(FIELD_MAP.keys())

SCHEDULE_LABELS = {
    "BKSKB": "本科生课表",
    "YJSKB": "研究生课表",
}

TERM_LABELS = {
    "1": "秋季",
    "2": "春季",
    "3": "暑校",
}


def ensure_database(settings: Settings) -> None:
    if not settings.database_path.exists():
        build_database(settings.raw_data_dir, settings.sample_csv_path, settings.database_path)


def _connect(database_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(database_path)
    conn.row_factory = sqlite3.Row
    return conn


def _data_version(conn: sqlite3.Connection) -> str:
    row = conn.execute("SELECT value FROM metadata WHERE key = 'data_version'").fetchone()
    return row["value"] if row else "unknown"


def _where(params: CourseSearchParams) -> Tuple[str, List[object]]:
    clauses = []
    args = []

    exact_filters = [
        ("academic_year", params.academic_year),
        ("term", params.term),
        ("schedule_type", params.schedule_type),
        ("course_type", params.course_type),
        ("department_id", params.department_id),
    ]
    for column, value in exact_filters:
        if value and value != "all":
            clauses.append("{} = ?".format(column))
            args.append(value)

    if params.teacher:
        clauses.append("teacher LIKE ?")
        args.append("%{}%".format(params.teacher.strip()))

    if params.keyword:
        keyword = "%{}%".format(params.keyword.strip())
        clauses.append(
            "(course_name LIKE ? OR course_id LIKE ? OR teacher LIKE ? OR schedule_time LIKE ? OR remark LIKE ?)"
        )
        args.extend([keyword, keyword, keyword, keyword, keyword])

    if not clauses:
        return "", args
    return "WHERE " + " AND ".join(clauses), args


def _to_item(row: sqlite3.Row) -> CourseItem:
    payload = {api_name: row[db_name] for db_name, api_name in FIELD_MAP.items()}
    return CourseItem(**payload)


def search_offline(settings: Settings, params: CourseSearchParams) -> CourseSearchResponse:
    ensure_database(settings)
    offset = (params.page - 1) * params.page_size
    where_sql, args = _where(params)

    with _connect(settings.database_path) as conn:
        total = conn.execute("SELECT COUNT(*) AS count FROM courses {}".format(where_sql), args).fetchone()["count"]
        rows = conn.execute(
            """
            SELECT {columns}
            FROM courses
            {where}
            ORDER BY academic_year DESC, term DESC, schedule_type, department_id, course_name, class_no
            LIMIT ? OFFSET ?
            """.format(columns=COURSE_SELECT, where=where_sql),
            args + [params.page_size, offset],
        ).fetchall()
        version = _data_version(conn)

    return CourseSearchResponse(
        source="offline",
        items=[_to_item(row) for row in rows],
        total=total,
        page=params.page,
        pageSize=params.page_size,
        hasMore=offset + len(rows) < total,
        dataVersion=version,
    )


def _distinct(conn: sqlite3.Connection, column: str) -> List[str]:
    rows = conn.execute(
        "SELECT DISTINCT {column} AS value FROM courses WHERE {column} != '' ORDER BY value".format(column=column)
    ).fetchall()
    return [row["value"] for row in rows]


def _options(values: Iterable[str], labels: Optional[Dict[str, str]] = None) -> List[Option]:
    labels = labels or {}
    options = [Option(id="all", name="全部")]
    options.extend(Option(id=value, name=labels.get(value, value)) for value in values)
    return options


def metadata(settings: Settings) -> MetaResponse:
    ensure_database(settings)
    with _connect(settings.database_path) as conn:
        years = sorted(_distinct(conn, "academic_year"), reverse=True)
        terms = _distinct(conn, "term")
        schedule_types = _distinct(conn, "schedule_type")
        course_types = _distinct(conn, "course_type")
        department_ids = _distinct(conn, "department_id")
        version = _data_version(conn)

    return MetaResponse(
        academicYears=years,
        terms=terms,
        scheduleTypes=_options(schedule_types, SCHEDULE_LABELS),
        courseTypes=_options(course_types),
        departments=_options(department_ids),
        onlineCourseTypes=[
            Option(id="0", name="全部"),
            Option(id="1-08", name="思政必修"),
            Option(id="1-09", name="大学英语"),
            Option(id="1-11", name="体育"),
            Option(id="1-07", name="全校公选课"),
            Option(id="2-通选课", name="通选课"),
            Option(id="2-通识核心课", name="通识核心课"),
            Option(id="3-英文", name="英语授课"),
        ],
        dataVersion=version,
    )


def export_csv(settings: Settings, params: CourseSearchParams, limit: int = 10000) -> str:
    limited = params.copy(update={"page": 1, "page_size": min(limit, 100)})
    response = search_offline(settings, limited)

    rows = response.items
    if response.total > len(rows):
        all_rows = list(rows)
        page = 2
        while len(all_rows) < min(response.total, limit):
            page_params = params.copy(update={"page": page, "page_size": 100})
            page_response = search_offline(settings, page_params)
            if not page_response.items:
                break
            all_rows.extend(page_response.items)
            page += 1
        rows = all_rows

    handle = io.StringIO()
    writer = csv.writer(handle)
    writer.writerow(
        [
            "classNo",
            "courseId",
            "courseName",
            "courseType",
            "credits",
            "remark",
            "scheduleTime",
            "scheduleWeek",
            "teacher",
            "url",
            "academicYear",
            "term",
            "scheduleType",
            "departmentId",
        ]
    )
    for item in rows[:limit]:
        writer.writerow(
            [
                item.classNo,
                item.courseId,
                item.courseName,
                item.courseType,
                item.credits if item.credits is not None else "",
                item.remark,
                item.scheduleTime,
                item.scheduleWeek,
                item.teacher,
                item.url,
                item.academicYear,
                item.term,
                item.scheduleType,
                item.departmentId,
            ]
        )
    return handle.getvalue()
