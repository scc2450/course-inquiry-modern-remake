from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from ..config import Settings, get_settings
from ..models import CourseSearchParams, CourseSearchResponse
from ..services.online_client import search_online
from ..services.repository import export_csv, search_offline

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("/search", response_model=CourseSearchResponse)
async def search_courses(
    params: CourseSearchParams = Depends(),
    settings: Settings = Depends(get_settings),
) -> CourseSearchResponse:
    if params.source == "online":
        return await search_online(settings, params)
    return search_offline(settings, params)


@router.get("/export.csv")
def export_courses(
    params: CourseSearchParams = Depends(),
    settings: Settings = Depends(get_settings),
) -> Response:
    csv_data = export_csv(settings, params)
    return Response(
        content="\ufeff" + csv_data,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="courses.csv"'},
    )
