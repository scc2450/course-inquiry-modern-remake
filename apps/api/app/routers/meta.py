from __future__ import annotations

from fastapi import APIRouter, Depends

from ..config import Settings, get_settings
from ..models import MetaResponse
from ..services.repository import metadata

router = APIRouter(tags=["metadata"])


@router.get("/meta", response_model=MetaResponse)
def get_meta(settings: Settings = Depends(get_settings)) -> MetaResponse:
    return metadata(settings)
