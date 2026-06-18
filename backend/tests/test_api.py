import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.core.settings import settings
from app.main import app
from app.services.prediction_log_service import PredictionLogService, get_prediction_log_service


client = TestClient(app)


@pytest.fixture
def temp_log_service(tmp_path):
    service = PredictionLogService(tmp_path / "predictions.jsonl")
    app.dependency_overrides[get_prediction_log_service] = lambda: service
    yield service
    app.dependency_overrides.clear()


def test_health_reports_model_loaded():
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "floodlens-api"
    assert body["model_loaded"] is True


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


def test_monitoring_summary_returns_empty_defaults(temp_log_service):
    response = client.get("/monitoring/summary")

    assert response.status_code == 200
    assert response.json() == {
        "total_predictions": 0,
        "low_risk_count": 0,
        "medium_risk_count": 0,
        "high_risk_count": 0,
        "average_risk_score": None,
        "latest_prediction_at": None,
        "model_versions": {},
        "top_districts_by_predictions": [],
    }


def test_monitoring_summary_counts_logged_predictions(temp_log_service):
    rows = pd.read_csv(settings.test_data_path, nrows=2)

    for _, row in rows.iterrows():
        response = client.post("/predict", json={"record": row.to_dict()})
        assert response.status_code == 200

    response = client.get("/monitoring/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["total_predictions"] == 2
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
