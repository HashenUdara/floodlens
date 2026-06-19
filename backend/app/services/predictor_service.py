"""Service wrapper around the saved FloodLens model bundle."""

import json
import sys
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import HTTPException, status

from app.core.settings import settings
from app.services.prediction_log_service import PredictionLogService, get_prediction_log_service


def _ensure_ml_import_path() -> None:
    ml_path = str(settings.ml_root)
    if ml_path not in sys.path:
        sys.path.insert(0, ml_path)


class PredictorService:
    def __init__(
        self,
        artifact_path: Path,
        metadata_path: Path,
        test_data_path: Path,
        log_service: PredictionLogService | None = None,
    ):
        _ensure_ml_import_path()
        from src.inference.predictor import FloodRiskPredictor

        self.artifact_path = artifact_path
        self.metadata_path = metadata_path
        self.test_data_path = test_data_path
        self.predictor = FloodRiskPredictor(artifact_path)
        self.metadata = self._load_metadata()
        self.required_fields = self._load_required_fields()
        self.log_service = log_service or get_prediction_log_service()

    @property
    def model_loaded(self) -> bool:
        return self.predictor is not None

    def model_info(self) -> dict[str, Any]:
        return self.metadata

    def predict(
        self,
        record: dict[str, Any],
        log_service: PredictionLogService | None = None,
    ) -> dict[str, Any]:
        self._validate_record(record)
        frame = pd.DataFrame([record])
        prediction = self.predictor.predict_frame(frame).iloc[0].to_dict()
        prediction["flood_risk_score"] = float(prediction["flood_risk_score"])
        (log_service or self.log_service).log_prediction(record, prediction)
        return prediction

    def predict_batch(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        for record in records:
            self._validate_record(record)

        if not records:
            return []

        frame = pd.DataFrame(records)
        predictions = self.predictor.predict_frame(frame).to_dict(orient="records")
        for prediction in predictions:
            prediction["flood_risk_score"] = float(prediction["flood_risk_score"])
        return predictions

    def _load_metadata(self) -> dict[str, Any]:
        if not self.metadata_path.exists():
            raise RuntimeError(f"Model metadata not found: {self.metadata_path}")
        return json.loads(self.metadata_path.read_text())

    def _load_required_fields(self) -> list[str]:
        if self.test_data_path.exists():
            return list(pd.read_csv(self.test_data_path, nrows=0).columns)

        config = self.predictor.config
        features = config["features"]
        required = {
            config["project"]["id_col"],
            "district",
            "reason_not_good_to_live",
            features.get("date_col", "generation_date"),
        }
        required.update(features.get("binary_cols", {}).keys())
        for pair in features.get("interactions", []):
            required.update(pair)
        required.update(features.get("missingness_flags", []))
        return sorted(required)

    def _validate_record(self, record: dict[str, Any]) -> None:
        missing = [field for field in self.required_fields if field not in record]
        if missing:
            detail = {
                "message": "Prediction record is missing required fields.",
                "missing_fields": missing,
            }
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


@lru_cache(maxsize=1)
def get_predictor_service() -> PredictorService:
    return PredictorService(
        artifact_path=settings.model_bundle_path,
        metadata_path=settings.model_metadata_path,
        test_data_path=settings.test_data_path,
    )
