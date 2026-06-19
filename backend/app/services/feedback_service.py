"""Human feedback logging and retraining signal summaries."""

import json
from collections import Counter
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status

from app.core.settings import settings
from app.services.location_service import MonitoredLocationProvider, get_location_service
from app.services.model_score_store import ModelScoreStore, get_model_score_store


VALID_RATINGS = {"useful", "not_useful"}
VALID_OUTCOMES = {"flooded", "not_flooded", "unknown"}
VALID_SOURCES = {"dashboard", "api"}

EMPTY_FEEDBACK_SUMMARY = {
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


class FeedbackService:
    def __init__(
        self,
        log_path: Path,
        provider: MonitoredLocationProvider,
        score_store: ModelScoreStore,
    ):
        self.log_path = log_path
        self.provider = provider
        self.score_store = score_store

    def submit_feedback(
        self,
        record_id: str,
        model_version: str,
        rating: str,
        observed_outcome: str = "unknown",
        notes: str | None = None,
        source: str = "dashboard",
    ) -> dict[str, Any]:
        self._validate_choice("rating", rating, VALID_RATINGS)
        self._validate_choice("observed_outcome", observed_outcome, VALID_OUTCOMES)
        self._validate_choice("source", source, VALID_SOURCES)

        record = self.provider.record(record_id)
        latest_score = self.score_store.get_score(record_id)
        risk_level = latest_score.get("risk_level") if latest_score else None
        flood_risk_score = latest_score.get("flood_risk_score") if latest_score else None
        disagreement = _is_disagreement(observed_outcome, risk_level)

        event = {
            "timestamp": _timestamp(),
            "record_id": record_id,
            "district": record.get("district"),
            "place_name": record.get("place_name"),
            "model_version": model_version,
            "rating": rating,
            "observed_outcome": observed_outcome,
            "notes": (notes or "").strip()[:500] or None,
            "source": source,
            "flood_risk_score": flood_risk_score,
            "risk_level": risk_level,
            "disagreement": disagreement,
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
                if line:
                    events.append(json.loads(line))
        return events

    def summary(self) -> dict[str, Any]:
        events = self.read_events()
        if not events:
            return dict(EMPTY_FEEDBACK_SUMMARY)

        ratings = Counter(event.get("rating") for event in events)
        outcomes = Counter(event.get("observed_outcome") for event in events)
        districts = Counter(event.get("district") for event in events if event.get("district"))
        disagreement_count = sum(1 for event in events if event.get("disagreement"))
        disagreement_rate = round(disagreement_count / len(events), 6)

        return {
            "total_feedback": len(events),
            "useful_count": ratings.get("useful", 0),
            "not_useful_count": ratings.get("not_useful", 0),
            "observed_flood_count": outcomes.get("flooded", 0),
            "observed_no_flood_count": outcomes.get("not_flooded", 0),
            "disagreement_count": disagreement_count,
            "disagreement_rate": disagreement_rate,
            "latest_feedback_at": max(event["timestamp"] for event in events if event.get("timestamp")),
            "retraining_candidate": is_feedback_retraining_candidate(events),
            "top_feedback_districts": [
                {"district": district, "count": count}
                for district, count in districts.most_common(5)
            ],
        }

    def _validate_choice(self, field: str, value: str, allowed: set[str]) -> None:
        if value not in allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "message": f"Invalid {field}.",
                    "allowed_values": sorted(allowed),
                },
            )


def is_feedback_retraining_candidate(events: list[dict[str, Any]]) -> bool:
    if len(events) < 5:
        return False
    disagreement_count = sum(1 for event in events if event.get("disagreement"))
    return disagreement_count / len(events) >= 0.3


def _is_disagreement(observed_outcome: str, risk_level: Any) -> bool:
    return (
        (observed_outcome == "flooded" and risk_level == "Low")
        or (observed_outcome == "not_flooded" and risk_level == "High")
    )


def _timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


@lru_cache(maxsize=1)
def get_feedback_service() -> FeedbackService:
    return FeedbackService(
        settings.feedback_log_path,
        provider=get_location_service(),
        score_store=get_model_score_store(),
    )
