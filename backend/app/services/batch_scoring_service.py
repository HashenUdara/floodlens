"""Batch model scoring for provider-backed monitored locations."""

from datetime import datetime, timezone
from typing import Any

from app.services.location_service import MonitoredLocationProvider
from app.services.model_score_store import ModelScoreStore
from app.services.prediction_log_service import PredictionLogService
from app.services.predictor_service import PredictorService


MAX_BATCH_LIMIT = 100


class BatchScoringService:
    def __init__(
        self,
        provider: MonitoredLocationProvider,
        predictor: PredictorService,
        log_service: PredictionLogService,
        score_store: ModelScoreStore,
    ):
        self.provider = provider
        self.predictor = predictor
        self.log_service = log_service
        self.score_store = score_store

    def score_locations(
        self,
        district: str | None = None,
        limit: int = MAX_BATCH_LIMIT,
        record_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        bounded_limit = max(1, min(limit, MAX_BATCH_LIMIT))
        locations = self._locations_for_request(district, bounded_limit, record_ids)
        batch_id = _batch_id()

        if not locations:
            return {
                "batch_id": batch_id,
                "source": "batch",
                "model_version": self.predictor.model_info().get("model_version"),
                "district": district,
                "requested": bounded_limit,
                "scored": 0,
                "predictions": [],
            }

        records = [self.provider.record(str(location["record_id"])) for location in locations]
        predictions = self.predictor.predict_batch(records)
        scored_at = _timestamp()

        response_predictions = []
        stored_scores = []
        for location, record, prediction in zip(locations, records, predictions, strict=True):
            self.log_service.log_prediction(
                record,
                prediction,
                source="batch",
                batch_id=batch_id,
            )
            response_prediction = {
                "record_id": prediction.get("record_id"),
                "district": location.get("district"),
                "place_name": location.get("place_name"),
                "baseline_risk_score": location.get("baseline_risk_score"),
                "baseline_risk_level": location.get("baseline_risk_level"),
                "operational_priority": location.get("operational_priority"),
                "flood_risk_score": prediction.get("flood_risk_score"),
                "risk_level": prediction.get("risk_level"),
                "model_version": prediction.get("model_version"),
            }
            response_predictions.append(response_prediction)
            stored_scores.append(
                {
                    **response_prediction,
                    "scored_at": scored_at,
                    "source": "batch",
                    "batch_id": batch_id,
                }
            )

        self.score_store.upsert_many(stored_scores)

        return {
            "batch_id": batch_id,
            "source": "batch",
            "model_version": self.predictor.model_info().get("model_version"),
            "district": district,
            "requested": len(locations),
            "scored": len(response_predictions),
            "predictions": response_predictions,
        }

    def _locations_for_request(
        self,
        district: str | None,
        limit: int,
        record_ids: list[str] | None,
    ) -> list[dict[str, Any]]:
        if district and district not in set(self.provider.districts()):
            return []

        if not record_ids:
            return self.provider.locations(district=district, limit=limit)

        wanted = set(record_ids)
        locations = self.provider.locations(district=district, limit=500)
        exact_matches = [
            location
            for location in locations
            if str(location.get("record_id")) in wanted
        ]
        return exact_matches[:limit]


def _timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _batch_id() -> str:
    return f"batch-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
