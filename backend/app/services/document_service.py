"""Document lifecycle and background ingestion orchestration."""

import hashlib
import logging
import uuid
from pathlib import Path

from sqlalchemy.exc import SQLAlchemyError

from app.core.settings import settings
from app.db.database import get_session_factory, require_session_factory
from app.db.models import Document
from app.services.document_extraction import chunk_pages, extract_document
from app.services.document_repository import DocumentRepository, serialize_document
from app.services.document_storage import DocumentStorage, get_document_storage
from app.services.embedding_service import EmbeddingProvider, get_embedding_provider

logger = logging.getLogger(__name__)

DOCUMENT_TYPES = {"sop", "policy", "field_report", "other"}
ALLOWED_SUFFIXES = {".pdf", ".txt", ".md", ".markdown"}
ALLOWED_MIME_TYPES = {
    ".pdf": {"application/pdf", "application/octet-stream"},
    ".txt": {"text/plain", "application/octet-stream"},
    ".md": {"text/markdown", "text/plain", "application/octet-stream"},
    ".markdown": {"text/markdown", "text/plain", "application/octet-stream"},
}


class DocumentServiceError(ValueError):
    def __init__(self, message: str, status_code: int = 422, **context: object):
        super().__init__(message)
        self.status_code = status_code
        self.context = context


def validate_document_content(filename: str, mime_type: str, content: bytes) -> str:
    safe_name = Path(filename).name.strip()
    suffix = Path(safe_name).suffix.lower()
    if not safe_name or suffix not in ALLOWED_SUFFIXES:
        raise DocumentServiceError("Only PDF, TXT, and Markdown files are supported.")
    if mime_type not in ALLOWED_MIME_TYPES[suffix]:
        raise DocumentServiceError("The file MIME type does not match its extension.")
    if suffix == ".pdf" and not content.startswith(b"%PDF-"):
        raise DocumentServiceError("The uploaded file is not a valid PDF.")
    if suffix != ".pdf" and b"\x00" in content[:4096]:
        raise DocumentServiceError("The uploaded text file appears to be binary.")
    if not content:
        raise DocumentServiceError("The uploaded document is empty.")
    max_bytes = settings.max_document_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise DocumentServiceError(
            f"Documents are limited to {settings.max_document_size_mb} MB."
        )
    return safe_name


class DocumentManagementService:
    def __init__(
        self,
        repository: DocumentRepository,
        storage: DocumentStorage | None = None,
    ):
        self.repository = repository
        self.storage = storage or get_document_storage()

    def create(
        self,
        *,
        filename: str,
        mime_type: str,
        content: bytes,
        title: str | None,
        document_type: str,
        district: str | None,
    ) -> dict[str, object]:
        safe_name = validate_document_content(filename, mime_type, content)
        if document_type not in DOCUMENT_TYPES:
            raise DocumentServiceError("Invalid document type.")
        normalized_title = (title or Path(safe_name).stem).strip()
        if not normalized_title or len(normalized_title) > 255:
            raise DocumentServiceError("Document title must contain 1 to 255 characters.")
        normalized_district = district.strip() if district and district.strip() else None
        digest = hashlib.sha256(content).hexdigest()
        duplicate = self.repository.find_by_hash(digest)
        if duplicate:
            raise DocumentServiceError(
                "This document has already been uploaded.",
                status_code=409,
                existing_document_id=str(duplicate.id),
            )

        identifier = uuid.uuid4()
        storage_key = f"{identifier}{Path(safe_name).suffix.lower()}"
        self.storage.save(storage_key, content)
        document = Document(
            id=identifier,
            title=normalized_title,
            original_filename=safe_name,
            mime_type=mime_type,
            document_type=document_type,
            district=normalized_district,
            size_bytes=len(content),
            sha256=digest,
            storage_key=storage_key,
            status="queued",
            embedding_model=settings.openai_embedding_model,
        )
        try:
            self.repository.add(document)
        except Exception:
            self.storage.delete(storage_key)
            raise
        return serialize_document(document)

    def list(self, **filters: object) -> list[dict[str, object]]:
        return [
            serialize_document(document)
            for document in self.repository.list_documents(**filters)
        ]

    def get(self, document_id: str) -> Document:
        document = self.repository.get(document_id)
        if document is None:
            raise DocumentServiceError("Document not found.", status_code=404)
        return document

    def delete(self, document_id: str) -> None:
        document = self.get(document_id)
        if document.status in {"queued", "processing"}:
            raise DocumentServiceError(
                "Wait for indexing to finish before deleting this document.",
                status_code=409,
            )
        storage_key = document.storage_key
        self.repository.delete(document)
        self.storage.delete(storage_key)

    def queue_reindex(self, document_id: str) -> dict[str, object]:
        document = self.get(document_id)
        if document.status in {"queued", "processing"}:
            raise DocumentServiceError("Document is already indexing.", status_code=409)
        self.repository.queue_reindex(document)
        return serialize_document(document)


class DocumentIngestionService:
    def __init__(
        self,
        storage: DocumentStorage | None = None,
        embeddings: EmbeddingProvider | None = None,
    ):
        self.storage = storage or get_document_storage()
        self.embeddings = embeddings or get_embedding_provider()

    def ingest(self, document_id: str) -> None:
        factory = require_session_factory()
        with factory() as session:
            repository = DocumentRepository(session)
            document = repository.get(document_id)
            if document is None:
                return
            repository.mark_processing(document)
            try:
                content = self.storage.read(document.storage_key)
                pages = extract_document(content, document.original_filename)
                chunks = chunk_pages(pages)
                vectors = self.embeddings.embed_texts([chunk.content for chunk in chunks])
                if len(vectors) != len(chunks):
                    raise RuntimeError("Embedding provider returned an unexpected result count.")
                repository.replace_chunks(document, chunks, vectors)
                logger.info(
                    "Document indexed id=%s chunks=%s model=%s",
                    document.id,
                    len(chunks),
                    self.embeddings.model_name,
                )
            except Exception as exc:
                session.rollback()
                document = repository.get(document_id)
                if document is not None:
                    repository.mark_failed(document, str(exc))
                logger.exception("Document indexing failed id=%s", document_id)


def run_document_ingestion(document_id: str) -> None:
    DocumentIngestionService().ingest(document_id)


def reconcile_interrupted_documents() -> int:
    factory = get_session_factory()
    if factory is None:
        return 0
    try:
        with factory() as session:
            return DocumentRepository(session).fail_interrupted()
    except SQLAlchemyError:
        logger.warning("Knowledge database unavailable during startup reconciliation.")
        return 0
