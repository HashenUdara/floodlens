"""Business-facing monitored location data from the current seed provider."""

from functools import lru_cache
import hashlib
import math
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

DISTRICT_CENTERS = {
    "Ampara": (7.2912, 81.6724),
    "Anuradhapura": (8.3114, 80.4037),
    "Badulla": (6.9934, 81.0550),
    "Batticaloa": (7.7170, 81.7000),
    "Colombo": (6.9271, 79.8612),
    "Galle": (6.0535, 80.2210),
    "Gampaha": (7.0873, 79.9990),
    "Hambantota": (6.1241, 81.1185),
    "Jaffna": (9.6615, 80.0255),
    "Kalutara": (6.5854, 79.9607),
    "Kandy": (7.2906, 80.6337),
    "Kegalle": (7.2513, 80.3464),
    "Kilinochchi": (9.3803, 80.3770),
    "Kurunegala": (7.4863, 80.3623),
    "Mannar": (8.9810, 79.9044),
    "Matale": (7.4675, 80.6234),
    "Matara": (5.9549, 80.5550),
    "Monaragala": (6.8728, 81.3507),
    "Mullaitivu": (9.2671, 80.8142),
    "Nuwara Eliya": (6.9497, 80.7891),
    "Polonnaruwa": (7.9403, 81.0188),
    "Puttalam": (8.0362, 79.8398),
    "Ratnapura": (6.6828, 80.3992),
    "Trincomalee": (8.5874, 81.2152),
    "Vavuniya": (8.7514, 80.4971),
}


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
        return [self._to_monitored_location(row) for row in self._records(frame)]

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

    def _to_monitored_location(self, row: dict[str, Any]) -> dict[str, Any]:
        baseline_score = _baseline_risk_score(row)
        baseline_level = _risk_level(baseline_score)
        map_latitude, map_longitude, coordinate_source = _presentation_coordinates(row)

        return {
            **row,
            "raw_latitude": row.get("latitude"),
            "raw_longitude": row.get("longitude"),
            "map_latitude": map_latitude,
            "map_longitude": map_longitude,
            "coordinate_source": coordinate_source,
            "asset_type": _asset_type(row),
            "data_provider": "seed_csv_provider",
            "baseline_risk_score": round(baseline_score, 4),
            "baseline_risk_level": baseline_level,
            "operational_priority": _operational_priority(baseline_score),
            "risk_drivers": _risk_drivers(row),
            "recommended_action": _recommended_action(baseline_score),
        }


def _presentation_coordinates(row: dict[str, Any]) -> tuple[float, float, str]:
    district = str(row.get("district") or "")
    raw_latitude = _as_float(row.get("latitude"))
    raw_longitude = _as_float(row.get("longitude"))

    if district not in DISTRICT_CENTERS:
        return raw_latitude or 7.8731, raw_longitude or 80.7718, "raw_coordinates"

    center_latitude, center_longitude = DISTRICT_CENTERS[district]
    offset_latitude, offset_longitude = _stable_offset(str(row.get("record_id") or ""))
    return (
        round(center_latitude + offset_latitude, 6),
        round(center_longitude + offset_longitude, 6),
        "district_centroid_corrected",
    )


def _stable_offset(seed: str) -> tuple[float, float]:
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    angle = int.from_bytes(digest[:2], "big") / 65535 * math.tau
    radius = 0.015 + (int.from_bytes(digest[2:4], "big") / 65535 * 0.07)
    return math.sin(angle) * radius, math.cos(angle) * radius


def _baseline_risk_score(row: dict[str, Any]) -> float:
    rainfall_7d = _clamp((_as_float(row.get("rainfall_7d_mm")) or 0) / 120)
    monthly_rainfall = _clamp((_as_float(row.get("monthly_rainfall_mm")) or 0) / 500)
    river_proximity = 1 - _clamp((_as_float(row.get("distance_to_river_m")) or 10000) / 10000)
    low_elevation = 1 - _clamp((_as_float(row.get("elevation_m")) or 800) / 800)
    flood_history = _clamp((_as_float(row.get("historical_flood_count")) or 0) / 5)
    evacuation_gap = _clamp((_as_float(row.get("nearest_evac_km")) or 0) / 30)
    infrastructure_gap = 1 - _clamp((_as_float(row.get("infrastructure_score")) or 50) / 100)

    score = (
        rainfall_7d * 0.24
        + monthly_rainfall * 0.14
        + river_proximity * 0.2
        + low_elevation * 0.16
        + flood_history * 0.1
        + evacuation_gap * 0.1
        + infrastructure_gap * 0.06
    )
    return _clamp(score)


def _risk_drivers(row: dict[str, Any]) -> list[str]:
    candidates = [
        ("High 7-day rainfall", (_as_float(row.get("rainfall_7d_mm")) or 0) / 120),
        ("High monthly rainfall", (_as_float(row.get("monthly_rainfall_mm")) or 0) / 500),
        ("Close to river network", 1 - ((_as_float(row.get("distance_to_river_m")) or 10000) / 10000)),
        ("Low elevation", 1 - ((_as_float(row.get("elevation_m")) or 800) / 800)),
        ("Limited evacuation access", (_as_float(row.get("nearest_evac_km")) or 0) / 30),
        ("Past flood exposure", (_as_float(row.get("historical_flood_count")) or 0) / 5),
        ("Infrastructure vulnerability", 1 - ((_as_float(row.get("infrastructure_score")) or 50) / 100)),
    ]
    ranked = sorted(((label, _clamp(value)) for label, value in candidates), key=lambda item: item[1], reverse=True)
    return [label for label, value in ranked[:3] if value >= 0.25]


def _recommended_action(score: float) -> str:
    if score >= 0.66:
        return "Dispatch field verification, alert local response teams, and prepare evacuation support."
    if score >= 0.45:
        return "Monitor rainfall and drainage conditions, then prepare a district response checklist."
    if score >= 0.33:
        return "Keep under watch and refresh conditions after the next rainfall update."
    return "Maintain routine monitoring; no immediate field action required."


def _operational_priority(score: float) -> str:
    if score >= 0.66:
        return "Critical"
    if score >= 0.45:
        return "Elevated"
    if score >= 0.33:
        return "Watch"
    return "Routine"


def _risk_level(score: float) -> str:
    if score >= 0.66:
        return "High"
    if score >= 0.33:
        return "Medium"
    return "Low"


def _asset_type(row: dict[str, Any]) -> str:
    landcover = str(row.get("landcover") or "").lower()
    urban_rural = str(row.get("urban_rural") or "").lower()
    if "urban" in urban_rural:
        return "Urban community"
    if "agriculture" in landcover:
        return "Agricultural area"
    if "water" in landcover:
        return "Water-adjacent area"
    return "Community area"


def _as_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


@lru_cache(maxsize=1)
def get_location_service() -> LocationService:
    return LocationService(settings.test_data_path)
