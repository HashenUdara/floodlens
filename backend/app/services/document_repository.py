"""Persistence operations for documents and chunks."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.orm import Session

from app.db.models import Document, DocumentChunk
from app.services.document_extraction import DocumentChunkData


def serialize_document(document: Document) -> dict[str, object]:
    return {
        "id": str(document.id),
        "title": document.title,
        "original_filename": document.original_filename,
        "mime_type": document.mime_type,
        "document_type": document.document_type,
        "district": document.district,
        "size_bytes": document.size_bytes,
        "status": document.status,
        "embedding_model": document.embedding_model,
        "chunk_count": document.chunk_count,
        "index_version": document.index_version,
        "failure_message": document.failure_message,
        "created_at": document.created_at.isoformat(),
        "updated_at": document.updated_at.isoformat(),
        "indexed_at": document.indexed_at.isoformat() if document.indexed_at else None,
    }


class DocumentRepository:
    def __init__(self, session: Session):
        self.session = session

    def get(self, document_id: str | uuid.UUID) -> Document | None:
        try:
            identifier = (
                document_id if isinstance(document_id, uuid.UUID) else uuid.UUID(document_id)
            )
        except (ValueError, TypeError):
            return None
        return self.session.get(Document, identifier)

    def find_by_hash(self, sha256: str) -> Document | None:
        return self.session.scalar(select(Document).where(Document.sha256 == sha256))

    def add(self, document: Document) -> Document:
        self.session.add(document)
        self.session.commit()
        self.session.refresh(document)
        return document

    def list_documents(
        self,
        *,
        status: str | None = None,
        district: str | None = None,
        document_type: str | None = None,
        search: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Document]:
        statement = select(Document)
        if status:
            statement = statement.where(Document.status == status)
        if district:
            statement = statement.where(Document.district == district)
        if document_type:
            statement = statement.where(Document.document_type == document_type)
        if search:
            pattern = f"%{search.strip()}%"
            statement = statement.where(
                or_(
                    Document.title.ilike(pattern),
                    Document.original_filename.ilike(pattern),
                    Document.district.ilike(pattern),
                )
            )
        statement = statement.order_by(Document.created_at.desc()).limit(limit).offset(offset)
        return list(self.session.scalars(statement))

    def summary(self) -> dict[str, object]:
        rows = dict(
            self.session.execute(
                select(Document.status, func.count(Document.id)).group_by(Document.status)
            ).all()
        )
        chunk_count = self.session.scalar(select(func.count(DocumentChunk.id))) or 0
        latest = self.session.scalar(select(func.max(Document.indexed_at)))
        return {
            "total": sum(rows.values()),
            "ready": rows.get("ready", 0),
            "indexing": rows.get("queued", 0) + rows.get("processing", 0),
            "failed": rows.get("failed", 0),
            "chunk_count": chunk_count,
            "latest_indexed_at": latest.isoformat() if latest else None,
        }

    def mark_processing(self, document: Document) -> None:
        document.status = "processing"
        document.failure_message = None
        document.updated_at = datetime.now(timezone.utc)
        self.session.commit()

    def replace_chunks(
        self,
        document: Document,
        chunks: list[DocumentChunkData],
        embeddings: list[list[float]],
    ) -> None:
        self.session.execute(
            delete(DocumentChunk).where(DocumentChunk.document_id == document.id)
        )
        for index, (chunk, embedding) in enumerate(zip(chunks, embeddings, strict=True)):
            self.session.add(
                DocumentChunk(
                    document_id=document.id,
                    chunk_index=index,
                    page_number=chunk.page_number,
                    content=chunk.content,
                    token_count=chunk.token_count,
                    chunk_metadata={"source": document.original_filename},
                    embedding=embedding,
                    search_vector=func.to_tsvector("english", chunk.content),
                )
            )
        document.status = "ready"
        document.chunk_count = len(chunks)
        document.failure_message = None
        document.indexed_at = datetime.now(timezone.utc)
        document.updated_at = document.indexed_at
        self.session.commit()

    def mark_failed(self, document: Document, message: str) -> None:
        document.status = "failed"
        document.failure_message = message[:1000]
        document.updated_at = datetime.now(timezone.utc)
        self.session.commit()

    def queue_reindex(self, document: Document) -> None:
        self.session.execute(
            delete(DocumentChunk).where(DocumentChunk.document_id == document.id)
        )
        document.status = "queued"
        document.chunk_count = 0
        document.index_version += 1
        document.failure_message = None
        document.indexed_at = None
        document.updated_at = datetime.now(timezone.utc)
        self.session.commit()

    def delete(self, document: Document) -> None:
        self.session.delete(document)
        self.session.commit()

    def fail_interrupted(self) -> int:
        result = self.session.execute(
            update(Document)
            .where(Document.status.in_(["queued", "processing"]))
            .values(
                status="failed",
                failure_message="Indexing was interrupted. Re-index this document.",
                updated_at=datetime.now(timezone.utc),
            )
        )
        self.session.commit()
        return result.rowcount or 0
