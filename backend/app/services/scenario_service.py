"""Scenario Lab context enrichment and what-if simulation."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

import httpx
import pandas as pd

from app.core.settings import settings
from app.services.geospatial_service import SriLankaBoundaryService, get_boundary_service
from app.services.location_service import (
    DISTRICT_CENTERS,
    MonitoredLocationProvider,
    _asset_type,
    _baseline_risk_score,
    _operational_priority,
    _recommended_action,
    _risk_drivers,
    _risk_level,
    get_location_service,
)
from app.services.prediction_log_service import PredictionLogService, get_prediction_log_service
from app.services.predictor_service import PredictorService, get_predictor_service


SCENARIO_FIELDS = {
    "rainfall_7d_mm",
    "monthly_rainfall_mm",
    "elevation_m",
    "distance_to_river_m",
    "nearest_evac_km",
    "population_density_per_km2",
    "historical_flood_count",
    "infrastructure_score",
}


class ScenarioService:
    def __init__(
        self,
        *,
        provider: MonitoredLocationProvider,
        predictor: PredictorService,
        log_service: PredictionLogService,
        boundary_service: SriLankaBoundaryService,
    ):
        self.provider = provider
        self.predictor = predictor
        self.log_service = log_service
        self.boundary_service = boundary_service

    def context(
        self,
        *,
        latitude: float,
        longitude: float,
        district: str | None = None,
        place_name: str | None = None,
    ) -> dict[str, Any]:
        self.boundary_service.require_inside(latitude, longitude)
        inferred_district = district or nearest_district(latitude, longitude)
        warnings = [
            "Rainfall and exposure fields are editable scenario assumptions unless a verified provider is connected."
        ]
        context_source = "manual_or_provider_default"
        elevation = None

        if settings.scenario_external_enrichment:
            try:
                elevation = fetch_open_meteo_elevation(latitude, longitude)
                if elevation is not None:
                    context_source = "open_meteo_elevation"
            except (httpx.HTTPError, ValueError, KeyError):
                warnings.append("External context lookup failed; using editable local defaults.")

        return {
            "inside_sri_lanka": True,
            "latitude": latitude,
            "longitude": longitude,
            "district": inferred_district,
            "place_name": place_name or "Custom scenario point",
            "context_source": context_source,
            "warnings": warnings,
            "context": {
                "elevation_m": elevation if elevation is not None else 25.0,
                "rainfall_7d_mm": 75.0,
                "monthly_rainfall_mm": 220.0,
                "distance_to_river_m": 1200.0,
                "nearest_evac_km": 4.0,
                "population_density_per_km2": 650.0,
                "historical_flood_count": 1.0,
                "infrastructure_score": 45.0,
            },
            "boundary": self.boundary_service.boundary_geojson(),
        }

    def simulate(
        self,
        *,
        record_id: str | None = None,
        location: dict[str, Any] | None = None,
        overrides: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        baseline_record = self._baseline_record(record_id=record_id, location=location)
        scenario_record = dict(baseline_record)
        scenario_record.update({key: value for key, value in (overrides or {}).items() if key in SCENARIO_FIELDS})
        scenario_record = self._normalize_record(scenario_record)

        baseline_score = _baseline_risk_score(baseline_record)
        scenario_baseline_score = _baseline_risk_score(scenario_record)
        predictions = self.predictor.predict_batch([scenario_record])
        prediction = predictions[0]
        prediction["flood_risk_score"] = float(prediction["flood_risk_score"])
        self.log_service.log_prediction(scenario_record, prediction, source="scenario")

        model_score = prediction["flood_risk_score"]
        changed_fields = sorted(
            field
            for field in SCENARIO_FIELDS
            if _value_changed(baseline_record.get(field), scenario_record.get(field))
        )
        baseline_level = _risk_level(baseline_score)
        scenario_level = prediction["risk_level"]

        return {
            "scenario_id": f"scenario-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
            "record_id": scenario_record.get("record_id"),
            "district": scenario_record.get("district"),
            "place_name": scenario_record.get("place_name"),
            "latitude": scenario_record.get("latitude"),
            "longitude": scenario_record.get("longitude"),
            "baseline_risk_score": round(baseline_score, 6),
            "baseline_risk_level": baseline_level,
            "simulated_baseline_risk_score": round(scenario_baseline_score, 6),
            "model_flood_risk_score": round(model_score, 6),
            "scenario_risk_score": round(model_score, 6),
            "scenario_risk_level": scenario_level,
            "score_delta": round(model_score - baseline_score, 6),
            "risk_level_delta": f"{baseline_level} -> {scenario_level}" if baseline_level != scenario_level else "No change",
            "changed_fields": changed_fields,
            "risk_drivers": _risk_drivers(scenario_record),
            "operational_priority": _operational_priority(model_score),
            "recommended_action": _recommended_action(model_score),
            "model_version": prediction.get("model_version"),
            "context_source": scenario_record.get("context_source", "provider_or_manual"),
            "scenario_record": scenario_record,
        }

    def _baseline_record(
        self,
        *,
        record_id: str | None,
        location: dict[str, Any] | None,
    ) -> dict[str, Any]:
        if record_id:
            return self._normalize_record(self.provider.record(record_id))
        if not location:
            raise ValueError("Either record_id or location is required.")

        latitude = float(location["latitude"])
        longitude = float(location["longitude"])
        self.boundary_service.require_inside(latitude, longitude)

        template = pd.read_csv(settings.test_data_path, nrows=1).iloc[0].to_dict()
        custom = {
            **template,
            **location,
            "record_id": location.get("record_id") or "SCENARIO-CUSTOM",
            "district": location.get("district") or nearest_district(latitude, longitude),
            "place_name": location.get("place_name") or "Custom scenario point",
            "latitude": latitude,
            "longitude": longitude,
            "context_source": location.get("context_source", "manual_or_provider_default"),
        }
        return self._normalize_record(custom)

    def _normalize_record(self, record: dict[str, Any]) -> dict[str, Any]:
        normalized = dict(record)
        for field in SCENARIO_FIELDS:
            if field in normalized:
                normalized[field] = _as_float(normalized[field], default=0.0)
        normalized["distance_to_river_m_log1p"] = math.log1p(max(0.0, _as_float(normalized.get("distance_to_river_m"))))
        normalized["population_density_per_km2_log1p"] = math.log1p(max(0.0, _as_float(normalized.get("population_density_per_km2"))))
        normalized["rainfall_7d_mm_log1p"] = math.log1p(max(0.0, _as_float(normalized.get("rainfall_7d_mm"))))
        normalized["monthly_rainfall_mm_log1p"] = math.log1p(max(0.0, _as_float(normalized.get("monthly_rainfall_mm"))))
        normalized["nearest_evac_km_log1p"] = math.log1p(max(0.0, _as_float(normalized.get("nearest_evac_km"))))
        normalized["elevation_m_yeojohnson"] = _as_float(normalized.get("elevation_m"))
        normalized["asset_type"] = _asset_type(normalized)
        return normalized


def nearest_district(latitude: float, longitude: float) -> str:
    return min(
        DISTRICT_CENTERS,
        key=lambda district: (DISTRICT_CENTERS[district][0] - latitude) ** 2
        + (DISTRICT_CENTERS[district][1] - longitude) ** 2,
    )


def fetch_open_meteo_elevation(latitude: float, longitude: float) -> float | None:
    response = httpx.get(
        "https://api.open-meteo.com/v1/elevation",
        params={"latitude": latitude, "longitude": longitude},
        timeout=settings.scenario_context_timeout_s,
    )
    response.raise_for_status()
    data = response.json()
    values = data.get("elevation")
    if isinstance(values, list) and values:
        return float(values[0])
    return None


def _as_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _value_changed(left: Any, right: Any) -> bool:
    try:
        return abs(float(left) - float(right)) > 1e-9
    except (TypeError, ValueError):
        return left != right


@lru_cache(maxsize=1)
def get_scenario_service() -> ScenarioService:
    return ScenarioService(
        provider=get_location_service(),
        predictor=get_predictor_service(),
        log_service=get_prediction_log_service(),
        boundary_service=get_boundary_service(),
    )
