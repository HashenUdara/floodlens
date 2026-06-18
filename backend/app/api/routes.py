"""HTTP routes for the FloodLens API."""

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from app.core.settings import settings
from app.services.prediction_log_service import PredictionLogService, get_prediction_log_service
from app.services.predictor_service import PredictorService, get_predictor_service

router = APIRouter()


class PredictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    record: dict[str, Any]


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


@router.get("/monitoring/summary")
def monitoring_summary(
    log_service: PredictionLogService = Depends(get_prediction_log_service),
) -> dict[str, Any]:
    return log_service.summary()
