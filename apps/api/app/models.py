from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


Source = Literal["offline", "online"]


class CourseSearchParams(BaseModel):
    source: Source = "offline"
    keyword: Optional[str] = None
    teacher: Optional[str] = None
    academic_year: Optional[str] = None
    term: Optional[str] = None
    schedule_type: Optional[str] = None
    course_type: Optional[str] = None
    department_id: Optional[str] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=25, ge=1, le=100)


class CourseItem(BaseModel):
    classNo: str
    courseId: str
    courseName: str
    courseType: str
    credits: Optional[float] = None
    remark: str = ""
    scheduleTime: str = ""
    scheduleWeek: str = ""
    teacher: str = ""
    url: str = ""
    academicYear: str = ""
    term: str = ""
    scheduleType: str = ""
    departmentId: str = ""


class CourseSearchResponse(BaseModel):
    source: Source
    items: List[CourseItem]
    total: int
    page: int
    pageSize: int
    hasMore: bool
    dataVersion: str


class Option(BaseModel):
    id: str
    name: str


class MetaResponse(BaseModel):
    academicYears: List[str]
    terms: List[str]
    scheduleTypes: List[Option]
    courseTypes: List[Option]
    departments: List[Option]
    onlineCourseTypes: List[Option]
    dataVersion: str
