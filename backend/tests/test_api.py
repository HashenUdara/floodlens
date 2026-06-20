import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.core.settings import settings
from app.main import app
from app.services.drift_monitoring_service import DriftMonitoringService, get_drift_monitoring_service
from app.services.feedback_service import FeedbackService, get_feedback_service
from app.services.location_service import MonitoredLocationProvider, get_location_service
from app.services.model_score_store import ModelScoreStore, get_model_score_store
from app.services.prediction_log_service import PredictionLogService, get_prediction_log_service
from app.services.geospatial_service import get_boundary_service
from app.services.predictor_service import get_predictor_service
from app.services.scenario_service import ScenarioService, get_scenario_service
from app.services.system_monitoring_service import (
    SystemMonitoringService,
    get_system_monitoring_service,
)


client = TestClient(app)


@pytest.fixture
def temp_log_service(tmp_path):
    service = PredictionLogService(tmp_path / "predictions.jsonl")
    app.dependency_overrides[get_prediction_log_service] = lambda: service
    app.dependency_overrides[get_scenario_service] = lambda: ScenarioService(
        provider=get_location_service(),
        predictor=get_predictor_service(),
        log_service=service,
        boundary_service=get_boundary_service(),
    )
    yield service
    app.dependency_overrides.clear()


@pytest.fixture
def temp_runtime_services(tmp_path):
    log_service = PredictionLogService(tmp_path / "predictions.jsonl")
    score_store = ModelScoreStore(tmp_path / "latest_scores.json")
    app.dependency_overrides[get_prediction_log_service] = lambda: log_service
    app.dependency_overrides[get_model_score_store] = lambda: score_store
    yield log_service, score_store
    app.dependency_overrides.clear()


@pytest.fixture
def temp_phase3_services(tmp_path):
    provider = get_location_service()
    log_service = PredictionLogService(tmp_path / "predictions.jsonl")
    score_store = ModelScoreStore(tmp_path / "latest_scores.json")
    feedback_service = FeedbackService(
        tmp_path / "feedback.jsonl",
        provider=provider,
        score_store=score_store,
    )
    drift_service = DriftMonitoringService(
        provider=provider,
        log_service=log_service,
        score_store=score_store,
        feedback_service=feedback_service,
    )
    scenario_service = ScenarioService(
        provider=provider,
        predictor=get_predictor_service(),
        log_service=log_service,
        boundary_service=get_boundary_service(),
    )

    app.dependency_overrides[get_prediction_log_service] = lambda: log_service
    app.dependency_overrides[get_model_score_store] = lambda: score_store
    app.dependency_overrides[get_feedback_service] = lambda: feedback_service
    app.dependency_overrides[get_drift_monitoring_service] = lambda: drift_service
    app.dependency_overrides[get_scenario_service] = lambda: scenario_service
    yield log_service, score_store, feedback_service, drift_service
    app.dependency_overrides.clear()


@pytest.fixture
def temp_system_service(tmp_path):
    service = SystemMonitoringService(tmp_path / "http_events.jsonl")
    app.state.system_monitoring_service = service
    app.dependency_overrides[get_system_monitoring_service] = lambda: service
    yield service
    app.dependency_overrides.clear()
    if hasattr(app.state, "system_monitoring_service"):
        delattr(app.state, "system_monitoring_service")


def test_health_reports_model_loaded():
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "floodlens-api"
    assert body["model_loaded"] is True


def test_readiness_reports_core_runtime_checks():
    response = client.get("/readiness")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"ready", "degraded"}
    assert body["service"] == "floodlens-api"
    assert body["checks"]["model_artifact"]["status"] == "ok"
    assert body["checks"]["model_loaded"]["status"] == "ok"
    assert body["checks"]["model_metadata"]["status"] == "ok"
    assert body["checks"]["seed_test_data"]["status"] == "ok"
    assert body["checks"]["upload_storage"]["status"] == "ok"
    assert body["checks"]["database"]["status"] in {"ok", "skipped", "failed"}


def test_model_info_returns_exported_metadata():
    response = client.get("/model-info")

    assert response.status_code == 200
    body = response.json()
    assert body["model_version"] == "flood-risk-v3"
    assert body["feature_count"] == 65
    assert "oof_mae" in body["metrics"]
    assert "oof_rmse" in body["metrics"]
    assert "test_std" in body["metrics"]


def test_predict_scores_first_test_row(temp_log_service):
    record = pd.read_csv(settings.test_data_path, nrows=1).iloc[0].to_dict()

    response = client.post("/predict", json={"record": record})

    assert response.status_code == 200
    body = response.json()
    assert body["record_id"] == record["record_id"]
    assert 0 <= body["flood_risk_score"] <= 1
    assert body["risk_level"] in {"Low", "Medium", "High"}
    assert body["model_version"] == "flood-risk-v3"

    events = temp_log_service.read_events()
    assert len(events) == 1
    assert events[0]["source"] == "api"
    assert events[0]["record_id"] == record["record_id"]
    assert events[0]["district"] == record["district"]
    assert events[0]["place_name"] == record["place_name"]
    assert events[0]["risk_level"] == body["risk_level"]
    assert events[0]["model_version"] == "flood-risk-v3"


def test_predict_rejects_missing_required_fields(temp_log_service):
    response = client.post("/predict", json={"record": {"record_id": "bad-row"}})

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["message"] == "Prediction record is missing required fields."
    assert "district" in detail["missing_fields"]
    assert temp_log_service.read_events() == []


def test_scenario_context_accepts_sri_lanka_coordinates():
    response = client.post(
        "/scenario/context",
        json={"latitude": 6.9271, "longitude": 79.8612, "place_name": "Colombo scenario"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["inside_sri_lanka"] is True
    assert body["district"] == "Colombo"
    assert body["context_source"] == "manual_or_provider_default"
    assert "boundary" in body
    assert body["context"]["rainfall_7d_mm"] > 0


def test_scenario_context_rejects_ocean_coordinates():
    response = client.post(
        "/scenario/context",
        json={"latitude": 2.0, "longitude": 80.0},
    )

    assert response.status_code == 422
    assert response.json()["detail"]["message"] == "Scenario coordinates must be inside Sri Lanka."


def test_scenario_context_rejects_foreign_coordinates():
    response = client.post(
        "/scenario/context",
        json={"latitude": 13.0827, "longitude": 80.2707},
    )

    assert response.status_code == 422


def test_scenario_simulate_existing_record_logs_scenario_source(temp_log_service):
    response = client.post(
        "/scenario/simulate",
        json={
            "record_id": "F104559",
            "overrides": {"rainfall_7d_mm": 180, "nearest_evac_km": 20},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["record_id"] == "F104559"
    assert 0 <= body["scenario_risk_score"] <= 1
    assert body["scenario_risk_level"] in {"Low", "Medium", "High"}
    assert body["score_delta"] is not None
    assert "rainfall_7d_mm" in body["changed_fields"]
    assert body["model_version"] == "flood-risk-v3"

    events = temp_log_service.read_events()
    assert len(events) == 1
    assert events[0]["source"] == "scenario"
    assert events[0]["record_id"] == "F104559"

    summary = client.get("/monitoring/summary").json()
    assert summary["total_predictions"] == 1
    assert summary["scenario_prediction_count"] == 1


def test_scenario_simulate_custom_location(temp_log_service):
    response = client.post(
        "/scenario/simulate",
        json={
            "location": {
                "latitude": 7.2906,
                "longitude": 80.6337,
                "district": "Kandy",
                "place_name": "Custom Kandy point",
            },
            "overrides": {
                "rainfall_7d_mm": 140,
                "monthly_rainfall_mm": 420,
                "elevation_m": 35,
                "distance_to_river_m": 450,
                "nearest_evac_km": 9,
                "population_density_per_km2": 1200,
                "historical_flood_count": 2,
                "infrastructure_score": 35,
            },
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["record_id"] == "SCENARIO-CUSTOM"
    assert body["district"] == "Kandy"
    assert 0 <= body["scenario_risk_score"] <= 1
    assert temp_log_service.read_events()[0]["source"] == "scenario"


def test_action_report_returns_pdf(temp_phase3_services):
    scenario_response = client.post(
        "/scenario/simulate",
        json={"record_id": "F104559", "overrides": {"rainfall_7d_mm": 150}},
    )
    assert scenario_response.status_code == 200

    response = client.post(
        "/reports/action",
        json={"scenario": scenario_response.json(), "citations": []},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


def test_action_report_rejects_missing_scenario():
    response = client.post("/reports/action", json={"citations": []})

    assert response.status_code == 422


def test_monitoring_summary_returns_empty_defaults(temp_log_service):
    response = client.get("/monitoring/summary")

    assert response.status_code == 200
    assert response.json() == {
        "total_predictions": 0,
        "single_prediction_count": 0,
        "batch_prediction_count": 0,
        "scenario_prediction_count": 0,
        "batch_run_count": 0,
        "latest_batch_id": None,
        "low_risk_count": 0,
        "medium_risk_count": 0,
        "high_risk_count": 0,
        "average_risk_score": None,
        "latest_prediction_at": None,
        "model_versions": {},
        "top_districts_by_predictions": [],
    }


def test_monitoring_system_returns_empty_defaults(temp_system_service):
    response = client.get("/monitoring/system")

    assert response.status_code == 200
    assert response.json() == {
        "total_requests": 0,
        "error_count": 0,
        "error_rate": 0,
        "p50_latency_ms": None,
        "p95_latency_ms": None,
        "routes": [],
        "latest_error_at": None,
        "document_indexing_failures": 0,
        "retrieval_events": 0,
    }


def test_monitoring_system_records_successful_and_failed_requests(temp_system_service):
    response = client.get("/health")
    assert response.status_code == 200

    response = client.get("/not-a-route")
    assert response.status_code == 404

    response = client.get("/monitoring/system")

    assert response.status_code == 200
    body = response.json()
    assert body["total_requests"] == 2
    assert body["error_count"] == 1
    assert body["error_rate"] == 0.5
    assert body["p50_latency_ms"] is not None
    assert body["p95_latency_ms"] is not None
    assert body["latest_error_at"] is not None
    routes = {item["route"]: item for item in body["routes"]}
    assert "GET /health" in routes
    assert "GET /not-a-route" in routes
    assert routes["GET /not-a-route"]["error_count"] == 1


def test_monitoring_summary_counts_logged_predictions(temp_log_service):
    rows = pd.read_csv(settings.test_data_path, nrows=2)

    for _, row in rows.iterrows():
        response = client.post("/predict", json={"record": row.to_dict()})
        assert response.status_code == 200

    response = client.get("/monitoring/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["total_predictions"] == 2
    assert body["single_prediction_count"] == 2
    assert body["batch_prediction_count"] == 0
    assert body["scenario_prediction_count"] == 0
    assert body["batch_run_count"] == 0
    assert body["latest_batch_id"] is None
    assert body["medium_risk_count"] == 2
    assert body["low_risk_count"] == 0
    assert body["high_risk_count"] == 0
    assert body["average_risk_score"] is not None
    assert body["latest_prediction_at"] is not None
    assert body["model_versions"] == {"flood-risk-v3": 2}
    assert body["top_districts_by_predictions"]


def test_districts_returns_sorted_dataset_districts():
    response = client.get("/districts")

    assert response.status_code == 200
    body = response.json()
    assert body == sorted(body)
    assert "Kilinochchi" in body
    assert "Matale" in body


def test_locations_returns_location_rows_with_coordinates():
    response = client.get("/locations", params={"limit": 2})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    first = body[0]
    assert first["record_id"] == "F104559"
    assert first["district"] == "Kilinochchi"
    assert first["place_name"] == "Kudakumbura South"
    assert isinstance(first["latitude"], float)
    assert isinstance(first["longitude"], float)
    assert first["raw_latitude"] == first["latitude"]
    assert first["raw_longitude"] == first["longitude"]
    assert first["map_latitude"] != first["latitude"]
    assert first["map_longitude"] != first["longitude"]
    assert first["coordinate_source"] == "district_centroid_corrected"
    assert "rainfall_7d_mm" in first
    assert "distance_to_river_m" in first
    assert first["data_provider"] == "seed_csv_provider"
    assert first["baseline_risk_level"] in {"Low", "Medium", "High"}
    assert 0 <= first["baseline_risk_score"] <= 1
    assert first["operational_priority"] in {"Routine", "Watch", "Elevated", "Critical"}
    assert first["recommended_action"]
    assert isinstance(first["risk_drivers"], list)


def test_locations_filters_by_district():
    response = client.get("/locations", params={"district": "Kilinochchi", "limit": 25})

    assert response.status_code == 200
    body = response.json()
    assert body
    assert {row["district"] for row in body} == {"Kilinochchi"}


def test_locations_search_matches_record_place_or_district():
    response = client.get("/locations", params={"search": "Kudakumbura", "limit": 10})

    assert response.status_code == 200
    body = response.json()
    assert body
    assert any(row["record_id"] == "F104559" for row in body)


def test_locations_limit_is_bounded():
    response = client.get("/locations", params={"limit": 1})

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_location_record_returns_full_prediction_payload():
    response = client.get("/locations/F104559/record")

    assert response.status_code == 200
    body = response.json()
    assert body["record_id"] == "F104559"
    assert body["district"] == "Kilinochchi"
    assert "reason_not_good_to_live" in body
    assert "generation_date" in body


def test_location_record_returns_404_for_unknown_record():
    response = client.get("/locations/not-a-record/record")

    assert response.status_code == 404


def test_location_service_implements_provider_contract():
    service = get_location_service()

    assert isinstance(service, MonitoredLocationProvider)
    assert service.districts()
    assert service.locations(limit=1)


def test_district_summary_returns_sorted_command_metrics():
    response = client.get("/district-summary")

    assert response.status_code == 200
    body = response.json()
    assert body
    scores = [row["average_baseline_risk_score"] for row in body]
    assert scores == sorted(scores, reverse=True)

    first = body[0]
    assert first["district"]
    assert first["monitored_places"] > 0
    assert 0 <= first["average_baseline_risk_score"] <= 1
    assert first["high_risk_count"] >= 0
    assert first["critical_priority_count"] >= 0
    assert first["elevated_priority_count"] >= 0
    assert isinstance(first["top_risk_drivers"], list)


def test_high_risk_locations_are_sorted_and_filterable():
    response = client.get("/high-risk-locations", params={"district": "Kilinochchi", "limit": 10})

    assert response.status_code == 200
    body = response.json()
    assert body
    assert len(body) <= 10
    assert {row["district"] for row in body} == {"Kilinochchi"}
    scores = [row["baseline_risk_score"] for row in body]
    assert scores == sorted(scores, reverse=True)
    assert {"record_id", "risk_drivers", "recommended_action"}.issubset(body[0])


def test_high_risk_locations_bounds_limit_and_handles_unknown_district():
    response = client.get("/high-risk-locations", params={"limit": 150})

    assert response.status_code == 200
    assert len(response.json()) == 100

    response = client.get("/high-risk-locations", params={"district": "Unknown"})
    assert response.status_code == 200
    assert response.json() == []


def test_emergency_priority_is_ranked_and_filterable():
    response = client.get("/emergency-priority", params={"district": "Kilinochchi", "limit": 10})

    assert response.status_code == 200
    body = response.json()
    assert body
    assert len(body) <= 10
    assert {row["district"] for row in body} == {"Kilinochchi"}
    scores = [row["emergency_priority_score"] for row in body]
    assert scores == sorted(scores, reverse=True)
    assert [row["rank"] for row in body] == list(range(1, len(body) + 1))
    assert isinstance(body[0]["priority_reasons"], list)
    assert body[0]["recommended_action"]


def test_emergency_priority_bounds_limit_and_handles_unknown_district():
    response = client.get("/emergency-priority", params={"limit": 150})

    assert response.status_code == 200
    assert len(response.json()) == 100

    response = client.get("/emergency-priority", params={"district": "Unknown"})
    assert response.status_code == 200
    assert response.json() == []


def test_batch_predict_scores_district_and_persists_latest_scores(temp_runtime_services):
    log_service, score_store = temp_runtime_services

    response = client.post("/batch-predict", json={"district": "Kilinochchi", "limit": 2})

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "batch"
    assert body["model_version"] == "flood-risk-v3"
    assert body["district"] == "Kilinochchi"
    assert body["requested"] == 2
    assert body["scored"] == 2
    assert len(body["predictions"]) == 2
    assert all(item["district"] == "Kilinochchi" for item in body["predictions"])
    assert all(0 <= item["flood_risk_score"] <= 1 for item in body["predictions"])
    assert all(item["risk_level"] in {"Low", "Medium", "High"} for item in body["predictions"])

    events = log_service.read_events()
    assert len(events) == 2
    assert {event["source"] for event in events} == {"batch"}
    assert {event["batch_id"] for event in events} == {body["batch_id"]}

    scores = score_store.list_scores(district="Kilinochchi")
    assert len(scores) == 2
    assert {score["batch_id"] for score in scores} == {body["batch_id"]}
    assert {score["source"] for score in scores} == {"batch"}

    response = client.get("/model-scores", params={"district": "Kilinochchi"})
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_batch_predict_caps_limit_and_handles_unknown_district(temp_runtime_services):
    response = client.post("/batch-predict", json={"limit": 150})

    assert response.status_code == 200
    body = response.json()
    assert body["requested"] == 100
    assert body["scored"] == 100
    assert len(body["predictions"]) == 100

    response = client.post("/batch-predict", json={"district": "Unknown", "limit": 5})

    assert response.status_code == 200
    body = response.json()
    assert body["requested"] == 5
    assert body["scored"] == 0
    assert body["predictions"] == []


def test_batch_predict_scores_record_ids_across_districts(temp_runtime_services):
    rows = pd.read_csv(settings.test_data_path)
    record_ids = [
        rows[rows["district"].astype(str) == "Kilinochchi"].iloc[0]["record_id"],
        rows[rows["district"].astype(str) == "Colombo"].iloc[0]["record_id"],
    ]

    response = client.post("/batch-predict", json={"record_ids": record_ids, "limit": 2})

    assert response.status_code == 200
    body = response.json()
    assert body["requested"] == 2
    assert body["scored"] == 2
    assert {item["record_id"] for item in body["predictions"]} == set(record_ids)
    assert {item["district"] for item in body["predictions"]} == {"Kilinochchi", "Colombo"}


def test_monitoring_summary_tracks_single_and_batch_sources(temp_runtime_services):
    rows = pd.read_csv(settings.test_data_path, nrows=1)
    response = client.post("/predict", json={"record": rows.iloc[0].to_dict()})
    assert response.status_code == 200

    response = client.post("/batch-predict", json={"district": "Kilinochchi", "limit": 2})
    assert response.status_code == 200
    batch_id = response.json()["batch_id"]

    response = client.get("/monitoring/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["total_predictions"] == 3
    assert body["single_prediction_count"] == 1
    assert body["batch_prediction_count"] == 2
    assert body["scenario_prediction_count"] == 0
    assert body["batch_run_count"] == 1
    assert body["latest_batch_id"] == batch_id


def test_feedback_summary_returns_empty_defaults(temp_phase3_services):
    response = client.get("/feedback/summary")

    assert response.status_code == 200
    assert response.json() == {
        "total_feedback": 0,
        "useful_count": 0,
        "not_useful_count": 0,
        "observed_flood_count": 0,
        "observed_no_flood_count": 0,
        "disagreement_count": 0,
        "disagreement_rate": 0,
        "latest_feedback_at": None,
        "retraining_candidate": False,
        "top_feedback_districts": [],
    }


def test_feedback_writes_event_and_counts_summary(temp_phase3_services):
    _, score_store, feedback_service, _ = temp_phase3_services
    record_id = "F104559"
    score_store.upsert_many(
        [
            {
                "record_id": record_id,
                "district": "Kilinochchi",
                "place_name": "Kudakumbura South",
                "flood_risk_score": 0.82,
                "risk_level": "High",
                "model_version": "flood-risk-v3",
                "scored_at": "2026-06-19T10:00:00Z",
                "source": "batch",
            }
        ]
    )

    response = client.post(
        "/feedback",
        json={
            "record_id": record_id,
            "model_version": "flood-risk-v3",
            "rating": "useful",
            "observed_outcome": "not_flooded",
            "notes": "field team reported normal conditions",
            "source": "dashboard",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["record_id"] == record_id
    assert body["district"] == "Kilinochchi"
    assert body["flood_risk_score"] == 0.82
    assert body["risk_level"] == "High"
    assert body["disagreement"] is True

    events = feedback_service.read_events()
    assert len(events) == 1
    assert events[0]["notes"] == "field team reported normal conditions"

    response = client.get("/feedback/summary")
    assert response.status_code == 200
    summary = response.json()
    assert summary["total_feedback"] == 1
    assert summary["useful_count"] == 1
    assert summary["observed_no_flood_count"] == 1
    assert summary["disagreement_count"] == 1
    assert summary["disagreement_rate"] == 1
    assert summary["retraining_candidate"] is False
    assert summary["top_feedback_districts"] == [{"district": "Kilinochchi", "count": 1}]


def test_feedback_rejects_invalid_rating_without_logging(temp_phase3_services):
    _, _, feedback_service, _ = temp_phase3_services

    response = client.post(
        "/feedback",
        json={
            "record_id": "F104559",
            "model_version": "flood-risk-v3",
            "rating": "maybe",
            "observed_outcome": "unknown",
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"]["message"] == "Invalid rating."
    assert feedback_service.read_events() == []


def test_feedback_unknown_record_does_not_write_event(temp_phase3_services):
    _, _, feedback_service, _ = temp_phase3_services

    response = client.post(
        "/feedback",
        json={
            "record_id": "not-a-record",
            "model_version": "flood-risk-v3",
            "rating": "useful",
            "observed_outcome": "unknown",
        },
    )

    assert response.status_code == 404
    assert feedback_service.read_events() == []


def test_feedback_summary_marks_retraining_candidate(temp_phase3_services):
    _, score_store, _, _ = temp_phase3_services
    rows = pd.read_csv(settings.test_data_path, nrows=5)
    score_store.upsert_many(
        [
            {
                "record_id": row["record_id"],
                "district": row["district"],
                "place_name": row["place_name"],
                "flood_risk_score": 0.9,
                "risk_level": "High",
                "model_version": "flood-risk-v3",
                "scored_at": "2026-06-19T10:00:00Z",
                "source": "batch",
            }
            for _, row in rows.iterrows()
        ]
    )

    for _, row in rows.iterrows():
        response = client.post(
            "/feedback",
            json={
                "record_id": row["record_id"],
                "model_version": "flood-risk-v3",
                "rating": "not_useful",
                "observed_outcome": "not_flooded",
            },
        )
        assert response.status_code == 200

    response = client.get("/feedback/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["total_feedback"] == 5
    assert body["disagreement_count"] == 5
    assert body["retraining_candidate"] is True


def test_monitoring_drift_returns_insufficient_data_without_predictions(temp_phase3_services):
    response = client.get("/monitoring/drift")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "insufficient_data"
    assert body["sample_size"] == 0
    assert body["reference_size"] > 0
    assert body["feature_warnings"] == []


def test_monitoring_drift_returns_shift_summary_after_batch_scoring(temp_phase3_services):
    response = client.post("/batch-predict", json={"district": "Kilinochchi", "limit": 10})
    assert response.status_code == 200

    response = client.get("/monitoring/drift")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"ok", "watch", "retraining_candidate"}
    assert body["sample_size"] == 10
    assert body["reference_size"] > body["sample_size"]
    assert {"recent_average", "reference_average", "absolute_difference"}.issubset(
        body["risk_score_shift"]
    )
    assert {"largest_shift_district", "absolute_difference"}.issubset(
        body["district_shift"]
    )
    assert isinstance(body["feature_warnings"], list)
    assert body["recommendation"]
