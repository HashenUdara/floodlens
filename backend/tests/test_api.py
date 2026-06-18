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
