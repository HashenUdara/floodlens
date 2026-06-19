from pathlib import Path
from types import SimpleNamespace
import uuid
from datetime import datetime, timezone

import fitz
import pytest

from app.db.models import Document, DocumentChunk
from app.services.document_extraction import (
    DocumentExtractionError,
    chunk_pages,
    extract_document,
)
from app.services.document_service import (
    DocumentManagementService,
    DocumentServiceError,
    validate_document_content,
)
from app.services.document_storage import LocalDocumentStorage
from app.services.retrieval_service import DocumentRetrievalService


class FakeRepository:
    def __init__(self):
        self.documents = []

    def find_by_hash(self, digest):
        return next((item for item in self.documents if item.sha256 == digest), None)

    def add(self, document):
        document.created_at = datetime.now(timezone.utc)
        document.updated_at = document.created_at
        self.documents.append(document)
        return document


class FakeEmbeddings:
    model_name = "test-embedding"

    def embed_query(self, _text):
        return [0.0] * 1536


class WhitespaceEncoding:
    def __init__(self):
        self.values = []

    def encode(self, text):
        self.values = text.split()
        return list(range(len(self.values)))

    def decode(self, tokens):
        return " ".join(self.values[token] for token in tokens)


class FakeResult:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows


class FakeSearchSession:
    def __init__(self, semantic_rows, lexical_rows):
        self.results = iter([FakeResult(semantic_rows), FakeResult(lexical_rows)])

    def execute(self, _statement):
        return next(self.results)


def make_pdf(*pages: str) -> bytes:
    document = fitz.open()
    for text in pages:
        page = document.new_page()
        if text:
            page.insert_text((72, 72), text)
    content = document.tobytes()
    document.close()
    return content


def test_pdf_extraction_preserves_page_numbers():
    pages = extract_document(make_pdf("Flood response step one", "Evacuation route"), "sop.pdf")

    assert [page.page_number for page in pages] == [1, 2]
    assert "Flood response" in pages[0].text
    assert "Evacuation route" in pages[1].text


def test_scanned_or_empty_pdf_returns_clear_error():
    with pytest.raises(DocumentExtractionError, match="OCR is not supported"):
        extract_document(make_pdf(""), "scan.pdf")


def test_markdown_chunking_preserves_overlap_and_source_page():
    text = " ".join(f"token-{index}" for index in range(1600))
    pages = extract_document(text.encode(), "field-report.md")
    chunks = chunk_pages(
        pages,
        chunk_tokens=100,
        overlap_tokens=20,
        encoding=WhitespaceEncoding(),
    )

    assert len(chunks) > 2
    assert all(chunk.page_number is None for chunk in chunks)
    assert all(chunk.token_count <= 100 for chunk in chunks)


def test_validation_rejects_spoofed_pdf_and_binary_text():
    with pytest.raises(DocumentServiceError, match="not a valid PDF"):
        validate_document_content("plan.pdf", "application/pdf", b"not a pdf")
    with pytest.raises(DocumentServiceError, match="appears to be binary"):
        validate_document_content("plan.txt", "text/plain", b"hello\x00world")


def test_local_storage_rejects_path_traversal(tmp_path: Path):
    storage = LocalDocumentStorage(tmp_path)

    with pytest.raises(ValueError, match="Invalid storage key"):
        storage.save("../outside.txt", b"unsafe")


def test_management_service_persists_file_and_rejects_duplicate(tmp_path: Path):
    repository = FakeRepository()
    storage = LocalDocumentStorage(tmp_path)
    service = DocumentManagementService(repository, storage)

    created = service.create(
        filename="Colombo SOP.md",
        mime_type="text/markdown",
        content=b"Inspect drainage channels before issuing field assignments.",
        title=None,
        document_type="sop",
        district="Colombo",
    )

    assert created["status"] == "queued"
    assert created["title"] == "Colombo SOP"
    assert len(list(tmp_path.iterdir())) == 1
    with pytest.raises(DocumentServiceError) as error:
        service.create(
            filename="copy.md",
            mime_type="text/markdown",
            content=b"Inspect drainage channels before issuing field assignments.",
            title="Copy",
            document_type="sop",
            district="Colombo",
        )
    assert error.value.status_code == 409
    assert error.value.context["existing_document_id"] == created["id"]


def test_hybrid_retrieval_merges_semantic_and_lexical_candidates():
    document = Document(
        id=uuid.uuid4(),
        title="Colombo Response SOP",
        original_filename="colombo-sop.pdf",
        mime_type="application/pdf",
        document_type="sop",
        district="Colombo",
        size_bytes=100,
        sha256="a" * 64,
        storage_key="source.pdf",
        status="ready",
        embedding_model="test-embedding",
    )
    shared = DocumentChunk(
        id=uuid.uuid4(),
        document_id=document.id,
        chunk_index=0,
        page_number=3,
        content="Deploy drainage inspection teams before road closures.",
        token_count=8,
        chunk_metadata={},
        embedding=[0.0] * 1536,
        search_vector=SimpleNamespace(),
    )
    semantic_only = DocumentChunk(
        id=uuid.uuid4(),
        document_id=document.id,
        chunk_index=1,
        page_number=4,
        content="Prepare temporary shelters for exposed households.",
        token_count=7,
        chunk_metadata={},
        embedding=[0.0] * 1536,
        search_vector=SimpleNamespace(),
    )
    session = FakeSearchSession(
        [(shared, document, 0.82), (semantic_only, document, 0.71)],
        [(shared, document, 0.55)],
    )

    result = DocumentRetrievalService(session, FakeEmbeddings()).search(
        "drainage inspection", district="Colombo", limit=2
    )

    assert result["source"] == "document-retrieval"
    assert [item["chunk_id"] for item in result["results"]] == [
        str(shared.id),
        str(semantic_only.id),
    ]
    assert result["results"][0]["page"] == 3
    assert result["results"][0]["citation_url"].endswith(
        f"/documents/{document.id}/file#page=3"
    )
