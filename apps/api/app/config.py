from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    data_dir: Path = Path(__file__).resolve().parents[1] / "data"
    database_path: Path = Path(__file__).resolve().parents[1] / "data" / "courses.sqlite"
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    enable_online: bool = True
    online_timeout_seconds: float = 10.0

    model_config = SettingsConfigDict(
        env_prefix="COURSE_",
        env_file=".env",
        extra="ignore",
    )

    @property
    def origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def raw_data_dir(self) -> Path:
        return self.data_dir / "raw" / "file"

    @property
    def sample_csv_path(self) -> Path:
        return self.data_dir / "sample_courses.csv"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
