"""HTTP routes for the FloodLens API."""

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from app.services.batch_scoring_service import BatchScoringService
from app.core.settings import settings
from app.services.decision_intelligence_service import (
    DecisionIntelligenceService,
    get_decision_intelligence_service,
)
from app.services.drift_monitoring_service import (
    DriftMonitoringService,
    get_drift_monitoring_service,
)
from app.services.feedback_service import FeedbackService, get_feedback_service
from app.services.location_service import LocationService, get_location_service
from app.services.model_score_store import ModelScoreStore, get_model_score_store
from app.services.prediction_log_service import PredictionLogService, get_prediction_log_service
from app.services.predictor_service import PredictorService, get_predictor_service

router = APIRouter()


class PredictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    record: dict[str, Any]


class BatchPredictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    district: str | None = None
    limit: int = Field(default=100, ge=1)
    record_ids: list[str] | None = None


class FeedbackRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    record_id: str
    model_version: str
    rating: str
    observed_outcome: str = "unknown"
    notes: str | None = None
    source: str = "dashboard"


@router.get("/health")
def health(service: PredictorService = Depends(get_predictor_service)) -> dict[str, Any]:
    return {
        "status": "ok",
        "service": settings.service_name,
        "model_loaded": service.model_loaded,
    }


@router.get("/model-info")
def model_info(service: PredictorService = Depends(get_predictor_service)) -> dict[str, Any]:
    return service.model_info()


@router.post("/predict")
def predict(
    payload: PredictRequest,
    service: PredictorService = Depends(get_predictor_service),
    log_service: PredictionLogService = Depends(get_prediction_log_service),
) -> dict[str, Any]:
    return service.predict(payload.record, log_service=log_service)


@router.post("/batch-predict")
def batch_predict(
    payload: BatchPredictRequest,
    provider: LocationService = Depends(get_location_service),
    predictor: PredictorService = Depends(get_predictor_service),
    log_service: PredictionLogService = Depends(get_prediction_log_service),
    score_store: ModelScoreStore = Depends(get_model_score_store),
) -> dict[str, Any]:
    service = BatchScoringService(
        provider=provider,
        predictor=predictor,
        log_service=log_service,
        score_store=score_store,
    )
    return service.score_locations(
        district=payload.district,
        limit=payload.limit,
        record_ids=payload.record_ids,
    )


@router.get("/monitoring/summary")
def monitoring_summary(
    log_service: PredictionLogService = Depends(get_prediction_log_service),
) -> dict[str, Any]:
    return log_service.summary()


@router.get("/monitoring/drift")
def monitoring_drift(
    service: DriftMonitoringService = Depends(get_drift_monitoring_service),
) -> dict[str, Any]:
    return service.summary()


@router.post("/feedback")
def submit_feedback(
    payload: FeedbackRequest,
    service: FeedbackService = Depends(get_feedback_service),
) -> dict[str, Any]:
    return service.submit_feedback(
        record_id=payload.record_id,
        model_version=payload.model_version,
        rating=payload.rating,
        observed_outcome=payload.observed_outcome,
        notes=payload.notes,
        source=payload.source,
    )


@router.get("/feedback/summary")
def feedback_summary(
    service: FeedbackService = Depends(get_feedback_service),
) -> dict[str, Any]:
    return service.summary()


@router.get("/model-scores")
def model_scores(
    district: str | None = None,
    limit: int = 100,
    score_store: ModelScoreStore = Depends(get_model_score_store),
) -> list[dict[str, Any]]:
    return score_store.list_scores(district=district, limit=limit)


@router.get("/districts")
def districts(service: LocationService = Depends(get_location_service)) -> list[str]:
    return service.districts()


@router.get("/locations")
def locations(
    district: str | None = None,
    search: str | None = None,
    limit: int = 250,
    service: LocationService = Depends(get_location_service),
) -> list[dict[str, Any]]:
    return service.locations(district=district, search=search, limit=limit)


@router.get("/locations/{record_id}/record")
def location_record(
    record_id: str,
    service: LocationService = Depends(get_location_service),
) -> dict[str, Any]:
    return service.record(record_id)


@router.get("/district-summary")
def district_summary(
    service: DecisionIntelligenceService = Depends(get_decision_intelligence_service),
) -> list[dict[str, Any]]:
    return service.district_summary()


@router.get("/high-risk-locations")
def high_risk_locations(
    district: str | None = None,
    limit: int = 25,
    service: DecisionIntelligenceService = Depends(get_decision_intelligence_service),
) -> list[dict[str, Any]]:
    return service.high_risk_locations(district=district, limit=limit)


@router.get("/emergency-priority")
def emergency_priority(
    district: str | None = None,
    limit: int = 25,
    service: DecisionIntelligenceService = Depends(get_decision_intelligence_service),
) -> list[dict[str, Any]]:
    return service.emergency_priority(district=district, limit=limit)
