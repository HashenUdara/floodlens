"""HTTP routes for the FloodLens API."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text

from app.services.action_report_service import ActionReportService
from app.services.batch_scoring_service import BatchScoringService
from app.core.settings import settings
from app.db.database import get_engine
from app.services.document_repository import DocumentRepository
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
from app.services.scenario_service import ScenarioService, get_scenario_service
from app.services.system_monitoring_service import (
    SystemMonitoringService,
    get_system_monitoring_service,
)

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


class ScenarioContextRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    latitude: float
    longitude: float
    district: str | None = None
    place_name: str | None = None


class ScenarioSimulateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    record_id: str | None = None
    location: dict[str, Any] | None = None
    overrides: dict[str, Any] = Field(default_factory=dict)


class ActionReportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scenario: dict[str, Any]
    citations: list[dict[str, Any]] = Field(default_factory=list)


@router.get("/health")
def health(service: PredictorService = Depends(get_predictor_service)) -> dict[str, Any]:
    return {
        "status": "ok",
        "service": settings.service_name,
        "model_loaded": service.model_loaded,
    }


@router.get("/readiness")
def readiness(service: PredictorService = Depends(get_predictor_service)) -> dict[str, Any]:
    checks = {
        "model_artifact": {
            "status": "ok" if settings.model_bundle_path.exists() else "failed",
            "path": str(settings.model_bundle_path),
        },
        "model_loaded": {
            "status": "ok" if service.model_loaded else "failed",
        },
        "model_metadata": {
            "status": "ok" if settings.model_metadata_path.exists() else "failed",
            "path": str(settings.model_metadata_path),
        },
        "seed_test_data": {
            "status": "ok" if settings.test_data_path.exists() else "failed",
            "path": str(settings.test_data_path),
        },
        "upload_storage": upload_storage_check(),
        "database": database_readiness_check(),
    }
    ready = all(
        check["status"] in {"ok", "skipped"} for check in checks.values()
    )
    return {
        "status": "ready" if ready else "degraded",
        "service": settings.service_name,
        "checks": checks,
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


@router.post("/scenario/context")
def scenario_context(
    payload: ScenarioContextRequest,
    service: ScenarioService = Depends(get_scenario_service),
) -> dict[str, Any]:
    return service.context(
        latitude=payload.latitude,
        longitude=payload.longitude,
        district=payload.district,
        place_name=payload.place_name,
    )


@router.post("/scenario/simulate")
def scenario_simulate(
    payload: ScenarioSimulateRequest,
    service: ScenarioService = Depends(get_scenario_service),
) -> dict[str, Any]:
    try:
        return service.simulate(
            record_id=payload.record_id,
            location=payload.location,
            overrides=payload.overrides,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": str(exc)},
        ) from exc


@router.post("/reports/action")
def action_report(
    payload: ActionReportRequest,
    log_service: PredictionLogService = Depends(get_prediction_log_service),
    feedback_service: FeedbackService = Depends(get_feedback_service),
    drift_service: DriftMonitoringService = Depends(get_drift_monitoring_service),
) -> Response:
    pdf = ActionReportService().build_pdf(
        scenario=payload.scenario,
        monitoring=log_service.summary(),
        feedback=feedback_service.summary(),
        drift=drift_service.summary(),
        citations=payload.citations,
    )
    filename = f"floodlens-action-{payload.scenario.get('record_id') or 'scenario'}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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


@router.get("/monitoring/system")
def monitoring_system(
    service: SystemMonitoringService = Depends(get_system_monitoring_service),
) -> dict[str, Any]:
    return service.summary(document_indexing_failures=document_indexing_failures())


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


def upload_storage_check() -> dict[str, Any]:
    try:
        settings.document_upload_dir.mkdir(parents=True, exist_ok=True)
        probe = settings.document_upload_dir / ".readiness_check"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        return {"status": "ok", "path": str(settings.document_upload_dir)}
    except OSError as error:
        return {
            "status": "failed",
            "path": str(settings.document_upload_dir),
            "message": str(error),
        }


def database_readiness_check() -> dict[str, Any]:
    if not settings.database_url:
        return {
            "status": "skipped",
            "message": "DATABASE_URL is not configured; Knowledge Library is disabled.",
        }
    engine = get_engine()
    if engine is None:
        return {"status": "failed", "message": "Database engine was not created."}
    try:
        with engine.connect() as connection:
            connection.execute(text("select 1"))
            revision = connection.execute(text("select version_num from alembic_version")).scalar()
        return {"status": "ok", "alembic_version": revision}
    except Exception as error:  # pragma: no cover - database driver-specific detail
        return {"status": "failed", "message": str(error)}


def document_indexing_failures() -> int:
    if not settings.database_url:
        return 0
    engine = get_engine()
    if engine is None:
        return 0
    try:
        from sqlalchemy.orm import Session

        with Session(engine) as session:
            return int(DocumentRepository(session).summary()["failed"])
    except Exception:
        return 0
