"""JSONL prediction logging and summary metrics for backend monitoring."""

import json
from collections import Counter
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.settings import settings


EMPTY_SUMMARY = {
    "total_predictions": 0,
    "low_risk_count": 0,
    "medium_risk_count": 0,
    "high_risk_count": 0,
    "average_risk_score": None,
    "latest_prediction_at": None,
    "model_versions": {},
    "top_districts_by_predictions": [],
}


class PredictionLogService:
    def __init__(self, log_path: Path):
        self.log_path = log_path

    def log_prediction(self, record: dict[str, Any], prediction: dict[str, Any]) -> dict[str, Any]:
        event = {
            "timestamp": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "source": "api",
            "record_id": prediction.get("record_id"),
            "district": record.get("district"),
            "place_name": record.get("place_name"),
            "flood_risk_score": prediction.get("flood_risk_score"),
            "risk_level": prediction.get("risk_level"),
            "model_version": prediction.get("model_version"),
        }
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        with self.log_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(event, ensure_ascii=True) + "\n")
        return event

    def read_events(self) -> list[dict[str, Any]]:
        if not self.log_path.exists():
            return []

        events = []
        with self.log_path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                events.append(json.loads(line))
        return events

    def summary(self) -> dict[str, Any]:
        events = self.read_events()
        if not events:
            return dict(EMPTY_SUMMARY)

        risk_counts = Counter(event.get("risk_level") for event in events)
        model_versions = Counter(event.get("model_version") for event in events if event.get("model_version"))
        districts = Counter(event.get("district") for event in events if event.get("district"))
        scores = [float(event["flood_risk_score"]) for event in events if event.get("flood_risk_score") is not None]
        latest_prediction_at = max(event["timestamp"] for event in events if event.get("timestamp"))

        return {
            "total_predictions": len(events),
            "low_risk_count": risk_counts.get("Low", 0),
            "medium_risk_count": risk_counts.get("Medium", 0),
            "high_risk_count": risk_counts.get("High", 0),
            "average_risk_score": round(sum(scores) / len(scores), 6) if scores else None,
            "latest_prediction_at": latest_prediction_at,
            "model_versions": dict(model_versions),
            "top_districts_by_predictions": [
                {"district": district, "count": count}
                for district, count in districts.most_common(5)
            ],
        }


@lru_cache(maxsize=1)
def get_prediction_log_service() -> PredictionLogService:
    return PredictionLogService(settings.prediction_log_path)
