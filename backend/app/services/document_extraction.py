"""Document extraction and token-aware chunking."""

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import fitz
import tiktoken


class DocumentExtractionError(ValueError):
    pass


class TokenEncoding(Protocol):
    def encode(self, text: str) -> list[int]: ...

    def decode(self, tokens: list[int]) -> str: ...


@dataclass(frozen=True)
class ExtractedPage:
    text: str
    page_number: int | None


@dataclass(frozen=True)
class DocumentChunkData:
    content: str
    page_number: int | None
    token_count: int


def extract_document(content: bytes, filename: str) -> list[ExtractedPage]:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        try:
            document = fitz.open(stream=content, filetype="pdf")
        except Exception as exc:
            raise DocumentExtractionError("The PDF could not be opened.") from exc
        try:
            pages = [
                ExtractedPage(text=page.get_text("text").strip(), page_number=index + 1)
                for index, page in enumerate(document)
            ]
        finally:
            document.close()
        pages = [page for page in pages if page.text]
        if not pages:
            raise DocumentExtractionError(
                "No selectable text was found. OCR is not supported yet."
            )
        return pages

    if suffix in {".txt", ".md", ".markdown"}:
        try:
            text = content.decode("utf-8-sig").strip()
        except UnicodeDecodeError:
            try:
                text = content.decode("latin-1").strip()
            except UnicodeDecodeError as exc:
                raise DocumentExtractionError("The text encoding is unsupported.") from exc
        if not text:
            raise DocumentExtractionError("The document is empty.")
        return [ExtractedPage(text=text, page_number=None)]

    raise DocumentExtractionError("Unsupported document format.")


def chunk_pages(
    pages: list[ExtractedPage],
    chunk_tokens: int = 800,
    overlap_tokens: int = 120,
    encoding: TokenEncoding | None = None,
) -> list[DocumentChunkData]:
    if overlap_tokens >= chunk_tokens:
        raise ValueError("Chunk overlap must be smaller than chunk size.")
    encoding = encoding or tiktoken.get_encoding("cl100k_base")
    chunks: list[DocumentChunkData] = []
    step = chunk_tokens - overlap_tokens

    for page in pages:
        tokens = encoding.encode(page.text)
        for start in range(0, len(tokens), step):
            token_slice = tokens[start : start + chunk_tokens]
            if not token_slice:
                continue
            text = encoding.decode(token_slice).strip()
            if text:
                chunks.append(
                    DocumentChunkData(
                        content=text,
                        page_number=page.page_number,
                        token_count=len(token_slice),
                    )
                )
            if start + chunk_tokens >= len(tokens):
                break
    if not chunks:
        raise DocumentExtractionError("No indexable text was found.")
    return chunks
