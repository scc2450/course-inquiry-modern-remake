from __future__ import annotations

from typing import Dict, List, Optional

import httpx
from bs4 import BeautifulSoup
from fastapi import HTTPException

from ..config import Settings
from ..models import CourseItem, CourseSearchParams, CourseSearchResponse
from .departments import department_name


TARGET = "https://dean.pku.edu.cn/service/web/courseSearch_do.php"
DETAIL_BASE = "https://dean.pku.edu.cn/service/web/courseDetail.php?flag=1&zxjhbh={plan}"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Referer": "https://dean.pku.edu.cn/service/web/courseSearch.php",
}


def _html_text(value: str, separator: str = "，") -> str:
    if not value:
        return ""
    soup = BeautifulSoup(value, "html.parser")
    pieces = [piece.get_text(strip=True) for piece in soup.find_all("p")]
    if pieces:
        return separator.join(piece for piece in pieces if piece)
    return soup.get_text(separator=separator, strip=True)


def _year_and_semester(params: CourseSearchParams) -> str:
    if params.academic_year and params.term:
        return "{}-{}".format(params.academic_year, params.term)
    return "24-25-2"


def _payload(params: CourseSearchParams) -> Dict[str, str]:
    department = params.department_id or "0"
    if department == "all":
        department = "0"
    course_type = params.course_type or "0"
    if course_type == "all":
        course_type = "0"
    return {
        "coursename": params.keyword or "",
        "teachername": params.teacher or "",
        "yearandseme": _year_and_semester(params),
        "coursetype": course_type,
        "yuanxi": department,
        "startrow": str((params.page - 1) * 100),
    }


def _to_course_item(raw: dict, params: CourseSearchParams) -> CourseItem:
    course_id = str(raw.get("kch") or "")
    plan = str(raw.get("zxjhbh") or "")
    detail_url = DETAIL_BASE.format(plan=plan) if plan else ""
    return CourseItem(
        classNo=str(raw.get("jxbh") or raw.get("xh") or ""),
        courseId=course_id,
        courseName=str(raw.get("kcmc") or ""),
        courseType=str(raw.get("kctxm") or ""),
        credits=_as_float(raw.get("xf")),
        remark=str(raw.get("bz") or ""),
        scheduleTime=_html_text(str(raw.get("sksj") or "")),
        scheduleWeek=str(raw.get("qzz") or ""),
        teacher=_html_text(str(raw.get("teacher") or ""), separator="/"),
        url=detail_url,
        academicYear=params.academic_year or "",
        term=params.term or "",
        scheduleType="BKSKB",
        departmentId=params.department_id or "",
        departmentName=department_name(params.department_id or ""),
    )


def _as_float(value: object) -> Optional[float]:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


async def search_online(settings: Settings, params: CourseSearchParams) -> CourseSearchResponse:
    if not settings.enable_online:
        raise HTTPException(status_code=503, detail="Online query is disabled in this deployment.")

    async with httpx.AsyncClient(timeout=settings.online_timeout_seconds, follow_redirects=True) as client:
        try:
            response = await client.post(TARGET, data=_payload(params), headers=HEADERS)
            response.raise_for_status()
            payload = response.json()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail="PKU course service is unavailable.") from exc
        except ValueError as exc:
            raise HTTPException(status_code=502, detail="PKU course service returned invalid JSON.") from exc

    if payload.get("status") != "ok":
        items: List[CourseItem] = []
        total = 0
    else:
        courses = payload.get("courselist") or []
        items = [_to_course_item(course, params) for course in courses]
        total = int(payload.get("count") or len(items))

    return CourseSearchResponse(
        source="online",
        items=items,
        total=total,
        page=params.page,
        pageSize=100,
        hasMore=params.page * 100 < total,
        dataVersion="live",
    )
