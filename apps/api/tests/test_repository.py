from pathlib import Path

from app.config import Settings
from app.models import CourseSearchParams
from app.services.ingest import build_database
from app.services.repository import metadata, search_offline


def test_offline_search_uses_sample_data(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    sample = data_dir / "sample_courses.csv"
    sample.write_text(
        "classNo,courseId,courseName,courseType,credits,remark,scheduleTime,scheduleWeek,teacher,url,学年,学期,课表类型,开课系所\n"
        "1,C001,贝叶斯理论,任选,3,,周一1-2,1-16,张三,http://example.test,24-25,2,BKSKB,00001\n",
        encoding="utf-8",
    )
    settings = Settings(data_dir=data_dir, database_path=data_dir / "courses.sqlite")
    build_database(settings.raw_data_dir, settings.sample_csv_path, settings.database_path)

    result = search_offline(settings, CourseSearchParams(keyword="贝叶斯"))

    assert result.total == 1
    assert result.items[0].courseName == "贝叶斯理论"


def test_metadata_contains_facets(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    sample = data_dir / "sample_courses.csv"
    sample.write_text(
        "classNo,courseId,courseName,courseType,credits,remark,scheduleTime,scheduleWeek,teacher,url,学年,学期,课表类型,开课系所\n"
        "1,C001,理论机器学习,任选,3,,周一1-2,1-16,张三,http://example.test,24-25,2,YJSKB,00001\n",
        encoding="utf-8",
    )
    settings = Settings(data_dir=data_dir, database_path=data_dir / "courses.sqlite")
    build_database(settings.raw_data_dir, settings.sample_csv_path, settings.database_path)

    meta = metadata(settings)

    assert "24-25" in meta.academicYears
    assert "98-99" in meta.academicYears
    assert {"1", "2", "3"}.issubset(set(meta.terms))
    assert meta.defaultAcademicYear == "24-25"
    assert meta.defaultTerm == "2"
    assert any(option.id == "YJSKB" for option in meta.scheduleTypes)
