"""Hybrid pgvector and PostgreSQL full-text retrieval."""

import logging
import time
import uuid
from dataclasses import dataclass

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.db.models import Document, DocumentChunk
from app.services.embedding_service import EmbeddingProvider, get_embedding_provider

logger = logging.getLogger(__name__)


@dataclass
class Candidate:
    chunk: DocumentChunk
    document: Document
    semantic_score: float | None = None
    lexical_score: float | None = None
    fused_score: float = 0.0


class DocumentRetrievalService:
    def __init__(
        self,
        session: Session,
        embeddings: EmbeddingProvider | None = None,
    ):
        self.session = session
        self.embeddings = embeddings or get_embedding_provider()

    @staticmethod
    def _filters(
        statement: Select,
        *,
        district: str | None,
        document_types: list[str] | None,
        document_ids: list[str] | None,
    ) -> Select:
        statement = statement.where(Document.status == "ready")
        if district:
            statement = statement.where(Document.district == district)
        if document_types:
            statement = statement.where(Document.document_type.in_(document_types))
        if document_ids:
            valid_ids = []
            for value in document_ids:
                try:
                    valid_ids.append(uuid.UUID(value))
                except (ValueError, TypeError):
                    continue
            if not valid_ids:
                return statement.where(False)
            statement = statement.where(Document.id.in_(valid_ids))
        return statement

    def search(
        self,
        query: str,
        *,
        district: str | None = None,
        document_types: list[str] | None = None,
        document_ids: list[str] | None = None,
        limit: int = 6,
    ) -> dict[str, object]:
        started = time.perf_counter()
        normalized_query = query.strip()
        if not normalized_query:
            return {"source": "document-retrieval", "results": []}
        limit = min(max(limit, 1), 10)
        query_vector = self.embeddings.embed_query(normalized_query)
        distance = DocumentChunk.embedding.cosine_distance(query_vector)
        semantic_score = (1 - distance).label("semantic_score")

        semantic = select(DocumentChunk, Document, semantic_score).join(Document)
        semantic = self._filters(
            semantic,
            district=district,
            document_types=document_types,
            document_ids=document_ids,
        )
        semantic_rows = self.session.execute(
            semantic.where(semantic_score >= 0.30).order_by(distance).limit(20)
        ).all()

        ts_query = func.websearch_to_tsquery("english", normalized_query)
        lexical_score = func.ts_rank_cd(
            DocumentChunk.search_vector, ts_query
        ).label("lexical_score")
        lexical = select(DocumentChunk, Document, lexical_score).join(Document)
        lexical = self._filters(
            lexical,
            district=district,
            document_types=document_types,
            document_ids=document_ids,
        )
        lexical_rows = self.session.execute(
            lexical.where(DocumentChunk.search_vector.op("@@")(ts_query))
            .order_by(lexical_score.desc())
            .limit(20)
        ).all()

        candidates: dict[uuid.UUID, Candidate] = {}
        for rank, (chunk, document, score) in enumerate(semantic_rows, start=1):
            candidate = candidates.setdefault(chunk.id, Candidate(chunk, document))
            candidate.semantic_score = float(score)
            candidate.fused_score += 1 / (60 + rank)
        for rank, (chunk, document, score) in enumerate(lexical_rows, start=1):
            candidate = candidates.setdefault(chunk.id, Candidate(chunk, document))
            candidate.lexical_score = float(score)
            candidate.fused_score += 1 / (60 + rank)

        ranked = sorted(candidates.values(), key=lambda item: item.fused_score, reverse=True)
        results = []
        for candidate in ranked[:limit]:
            page_fragment = (
                f"#page={candidate.chunk.page_number}"
                if candidate.chunk.page_number
                else ""
            )
            citation_url = (
                f"{settings.public_api_base_url}/documents/{candidate.document.id}/file"
                f"{page_fragment}"
            )
            results.append(
                {
                    "chunk_id": str(candidate.chunk.id),
                    "document_id": str(candidate.document.id),
                    "title": candidate.document.title,
                    "document_type": candidate.document.document_type,
                    "district": candidate.document.district,
                    "page": candidate.chunk.page_number,
                    "excerpt": candidate.chunk.content[:700],
                    "semantic_score": round(candidate.semantic_score, 4)
                    if candidate.semantic_score is not None
                    else None,
                    "fused_relevance": round(candidate.fused_score, 6),
                    "citation_url": citation_url,
                }
            )
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        logger.info(
            "Document retrieval results=%s latency_ms=%s model=%s filters=%s",
            len(results),
            elapsed_ms,
            self.embeddings.model_name,
            bool(district or document_types or document_ids),
        )
        return {
            "source": "document-retrieval",
            "embedding_model": self.embeddings.model_name,
            "latency_ms": elapsed_ms,
            "results": results,
        }
