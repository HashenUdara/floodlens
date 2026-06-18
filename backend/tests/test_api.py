import pandas as pd
from fastapi.testclient import TestClient

from app.core.settings import settings
from app.main import app


client = TestClient(app)


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


def test_predict_scores_first_test_row():
    record = pd.read_csv(settings.test_data_path, nrows=1).iloc[0].to_dict()

    response = client.post("/predict", json={"record": record})

    assert response.status_code == 200
    body = response.json()
    assert body["record_id"] == record["record_id"]
    assert 0 <= body["flood_risk_score"] <= 1
    assert body["risk_level"] in {"Low", "Medium", "High"}
    assert body["model_version"] == "flood-risk-v3"


def test_predict_rejects_missing_required_fields():
    response = client.post("/predict", json={"record": {"record_id": "bad-row"}})

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["message"] == "Prediction record is missing required fields."
    assert "district" in detail["missing_fields"]
