"""Lightweight drift and retraining signals for model operations."""

from collections import Counter
from functools import lru_cache
from typing import Any

import pandas as pd
from fastapi import HTTPException

from app.core.settings import settings
from app.services.feedback_service import FeedbackService, get_feedback_service
from app.services.location_service import LOCATION_COLUMNS, MonitoredLocationProvider, _baseline_risk_score, get_location_service
from app.services.model_score_store import ModelScoreStore, get_model_score_store
from app.services.prediction_log_service import PredictionLogService, get_prediction_log_service


NUMERIC_FEATURES = [
    "rainfall_7d_mm",
    "monthly_rainfall_mm",
    "elevation_m",
    "distance_to_river_m",
    "nearest_evac_km",
    "population_density_per_km2",
    "historical_flood_count",
    "infrastructure_score",
]

INSUFFICIENT_SAMPLE_SIZE = 10


class DriftMonitoringService:
    def __init__(
        self,
        provider: MonitoredLocationProvider,
        log_service: PredictionLogService,
        score_store: ModelScoreStore,
        feedback_service: FeedbackService,
    ):
        self.provider = provider
        self.log_service = log_service
        self.score_store = score_store
        self.feedback_service = feedback_service

    def summary(self) -> dict[str, Any]:
        recent = self._recent_scored_records()
        reference = self._reference_records()

        if len(recent) < INSUFFICIENT_SAMPLE_SIZE:
            return {
                "status": "insufficient_data",
                "sample_size": len(recent),
                "reference_size": len(reference),
                "risk_score_shift": {
                    "recent_average": None,
                    "reference_average": _average_baseline(reference),
                    "absolute_difference": None,
                },
                "district_shift": {
                    "largest_shift_district": None,
                    "absolute_difference": None,
                },
                "feature_warnings": [],
                "recommendation": "Run batch scoring before evaluating drift.",
            }

        risk_shift = _risk_score_shift(recent, reference)
        district_shift = _district_shift(recent, reference)
        feature_warnings = _feature_warnings(recent, reference)
        status_value = _status(risk_shift, district_shift, feature_warnings, self.feedback_service.summary())

        return {
            "status": status_value,
            "sample_size": len(recent),
            "reference_size": len(reference),
            "risk_score_shift": risk_shift,
            "district_shift": district_shift,
            "feature_warnings": feature_warnings,
            "recommendation": _recommendation(status_value),
        }

    def _recent_scored_records(self) -> list[dict[str, Any]]:
        scores_by_record = {
            score["record_id"]: score
            for score in self.score_store.list_scores(limit=100)
            if score.get("record_id")
        }
        for event in reversed(self.log_service.read_events()):
            record_id = event.get("record_id")
            if record_id and record_id not in scores_by_record:
                scores_by_record[record_id] = event
            if len(scores_by_record) >= 100:
                break

        rows = []
        for record_id, score in scores_by_record.items():
            try:
                record = self.provider.record(str(record_id))
            except HTTPException:
                continue
            rows.append(
                {
                    **record,
                    "flood_risk_score": score.get("flood_risk_score"),
                    "risk_level": score.get("risk_level"),
                }
            )
        return rows

    def _reference_records(self) -> list[dict[str, Any]]:
        frame = pd.read_csv(settings.test_data_path, usecols=lambda col: col in LOCATION_COLUMNS)
        return frame.where(pd.notnull(frame), None).to_dict(orient="records")


def _risk_score_shift(
    recent: list[dict[str, Any]],
    reference: list[dict[str, Any]],
) -> dict[str, Any]:
    recent_scores = [_as_float(row.get("flood_risk_score")) for row in recent]
    recent_scores = [score for score in recent_scores if score is not None]
    recent_average = sum(recent_scores) / len(recent_scores) if recent_scores else None
    reference_average = _average_baseline(reference)
    absolute_difference = (
        abs(recent_average - reference_average)
        if recent_average is not None and reference_average is not None
        else None
    )
    return {
        "recent_average": _rounded(recent_average),
        "reference_average": _rounded(reference_average),
        "absolute_difference": _rounded(absolute_difference),
    }


def _district_shift(
    recent: list[dict[str, Any]],
    reference: list[dict[str, Any]],
) -> dict[str, Any]:
    recent_distribution = _distribution(row.get("district") for row in recent)
    reference_distribution = _distribution(row.get("district") for row in reference)
    districts = set(recent_distribution) | set(reference_distribution)
    if not districts:
        return {"largest_shift_district": None, "absolute_difference": None}

    district, value = max(
        ((item, abs(recent_distribution.get(item, 0) - reference_distribution.get(item, 0))) for item in districts),
        key=lambda item: item[1],
    )
    return {
        "largest_shift_district": district,
        "absolute_difference": _rounded(value),
    }


def _feature_warnings(
    recent: list[dict[str, Any]],
    reference: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    warnings = []
    for feature in NUMERIC_FEATURES:
        recent_mean = _mean(row.get(feature) for row in recent)
        reference_mean = _mean(row.get(feature) for row in reference)
        if recent_mean is None or reference_mean is None:
            continue

        denominator = abs(reference_mean) if abs(reference_mean) > 1e-9 else 1
        relative_change = abs(recent_mean - reference_mean) / denominator
        if relative_change >= 0.35:
            warnings.append(
                {
                    "feature": feature,
                    "recent_mean": _rounded(recent_mean),
                    "reference_mean": _rounded(reference_mean),
                    "relative_change": _rounded(relative_change),
                    "status": "retraining_candidate" if relative_change >= 0.6 else "watch",
                }
            )

    return sorted(warnings, key=lambda item: item["relative_change"], reverse=True)


def _status(
    risk_shift: dict[str, Any],
    district_shift: dict[str, Any],
    feature_warnings: list[dict[str, Any]],
    feedback_summary: dict[str, Any],
) -> str:
    risk_difference = risk_shift.get("absolute_difference") or 0
    district_difference = district_shift.get("absolute_difference") or 0
    largest_feature_shift = max((item["relative_change"] for item in feature_warnings), default=0)

    if (
        risk_difference >= 0.25
        or district_difference >= 0.35
        or largest_feature_shift >= 0.6
        or feedback_summary.get("retraining_candidate")
    ):
        return "retraining_candidate"
    if risk_difference >= 0.15 or district_difference >= 0.2 or largest_feature_shift >= 0.35:
        return "watch"
    return "ok"


def _recommendation(status_value: str) -> str:
    if status_value == "retraining_candidate":
        return "Review feedback disagreements and prepare a retraining candidate run."
    if status_value == "watch":
        return "Monitor feature shift and collect more feedback before retraining."
    if status_value == "insufficient_data":
        return "Run batch scoring before evaluating drift."
    return "No drift action required from current logged activity."


def _average_baseline(rows: list[dict[str, Any]]) -> float | None:
    if not rows:
        return None
    scores = [_baseline_risk_score(row) for row in rows]
    return sum(scores) / len(scores) if scores else None


def _distribution(values: Any) -> dict[str, float]:
    clean = [str(value) for value in values if value]
    total = len(clean)
    if total == 0:
        return {}
    return {key: count / total for key, count in Counter(clean).items()}


def _mean(values: Any) -> float | None:
    clean = [_as_float(value) for value in values]
    clean = [value for value in clean if value is not None]
    return sum(clean) / len(clean) if clean else None


def _as_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _rounded(value: float | None) -> float | None:
    return round(value, 6) if value is not None else None


@lru_cache(maxsize=1)
def get_drift_monitoring_service() -> DriftMonitoringService:
    return DriftMonitoringService(
        provider=get_location_service(),
        log_service=get_prediction_log_service(),
        score_store=get_model_score_store(),
        feedback_service=get_feedback_service(),
    )
