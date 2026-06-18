"""Read-only location explorer data from the test dataset."""

from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import HTTPException, status

from app.core.settings import settings


LOCATION_COLUMNS = [
    "record_id",
    "district",
    "place_name",
    "latitude",
    "longitude",
    "rainfall_7d_mm",
    "monthly_rainfall_mm",
    "elevation_m",
    "distance_to_river_m",
    "nearest_evac_km",
    "population_density_per_km2",
    "historical_flood_count",
    "infrastructure_score",
    "urban_rural",
    "landcover",
    "soil_type",
]


class LocationService:
    def __init__(self, test_data_path: Path):
        self.test_data_path = test_data_path

    def districts(self) -> list[str]:
        frame = self._load_frame()
        return sorted(frame["district"].dropna().astype(str).unique().tolist())

    def locations(
        self,
        district: str | None = None,
        search: str | None = None,
        limit: int = 250,
    ) -> list[dict[str, Any]]:
        frame = self._load_frame()

        if district:
            frame = frame[frame["district"].astype(str) == district]

        if search:
            query = search.strip().lower()
            if query:
                searchable = (
                    frame["record_id"].astype(str)
                    + " "
                    + frame["district"].astype(str)
                    + " "
                    + frame["place_name"].astype(str)
                ).str.lower()
                frame = frame[searchable.str.contains(query, na=False, regex=False)]

        limit = max(1, min(limit, 500))
        frame = frame.head(limit)
        return self._records(frame)

    def record(self, record_id: str) -> dict[str, Any]:
        if not self.test_data_path.exists():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Test dataset not found: {self.test_data_path}",
            )

        frame = pd.read_csv(self.test_data_path)
        matches = frame[frame["record_id"].astype(str) == record_id]
        if matches.empty:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Location record not found: {record_id}",
            )
        return self._records(matches.head(1))[0]

    def _load_frame(self) -> pd.DataFrame:
        if not self.test_data_path.exists():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Test dataset not found: {self.test_data_path}",
            )

        frame = pd.read_csv(self.test_data_path, usecols=lambda col: col in LOCATION_COLUMNS)
        required = {"record_id", "district", "place_name", "latitude", "longitude"}
        missing = required.difference(frame.columns)
        if missing:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Test dataset is missing location columns: {sorted(missing)}",
            )
        return frame

    def _records(self, frame: pd.DataFrame) -> list[dict[str, Any]]:
        clean = frame.where(pd.notnull(frame), None)
        return clean.to_dict(orient="records")


@lru_cache(maxsize=1)
def get_location_service() -> LocationService:
    return LocationService(settings.test_data_path)
