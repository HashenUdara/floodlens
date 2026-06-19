"""Lightweight latest model-score persistence for monitored places."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.settings import settings


MAX_LIMIT = 100


class ModelScoreStore:
    def __init__(self, score_path: Path):
        self.score_path = score_path

    def upsert_many(self, scores: list[dict[str, Any]]) -> None:
        current = {score["record_id"]: score for score in self._read_all()}
        for score in scores:
            if score.get("record_id"):
                current[str(score["record_id"])] = score

        self.score_path.parent.mkdir(parents=True, exist_ok=True)
        ordered = sorted(
            current.values(),
            key=lambda score: str(score.get("scored_at") or ""),
            reverse=True,
        )
        self.score_path.write_text(json.dumps(ordered, ensure_ascii=True, indent=2))

    def list_scores(
        self,
        district: str | None = None,
        limit: int = MAX_LIMIT,
    ) -> list[dict[str, Any]]:
        scores = self._read_all()
        if district:
            scores = [score for score in scores if score.get("district") == district]

        bounded_limit = max(1, min(limit, MAX_LIMIT))
        return sorted(
            scores,
            key=lambda score: str(score.get("scored_at") or ""),
            reverse=True,
        )[:bounded_limit]

    def get_score(self, record_id: str) -> dict[str, Any] | None:
        for score in self._read_all():
            if str(score.get("record_id")) == record_id:
                return score
        return None

    def _read_all(self) -> list[dict[str, Any]]:
        if not self.score_path.exists():
            return []
        return json.loads(self.score_path.read_text())


@lru_cache(maxsize=1)
def get_model_score_store() -> ModelScoreStore:
    return ModelScoreStore(settings.latest_scores_path)
