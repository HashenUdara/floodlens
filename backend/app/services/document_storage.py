"""Replaceable binary storage for uploaded knowledge documents."""

from functools import lru_cache
from pathlib import Path
from typing import Protocol, runtime_checkable

from app.core.settings import settings


@runtime_checkable
class DocumentStorage(Protocol):
    def save(self, storage_key: str, content: bytes) -> Path: ...

    def read(self, storage_key: str) -> bytes: ...

    def path(self, storage_key: str) -> Path: ...

    def delete(self, storage_key: str) -> None: ...


class LocalDocumentStorage:
    def __init__(self, root: Path):
        self.root = root

    def _safe_path(self, storage_key: str) -> Path:
        candidate = (self.root / storage_key).resolve()
        root = self.root.resolve()
        if candidate.parent != root:
            raise ValueError("Invalid storage key.")
        return candidate

    def save(self, storage_key: str, content: bytes) -> Path:
        self.root.mkdir(parents=True, exist_ok=True)
        path = self._safe_path(storage_key)
        path.write_bytes(content)
        return path

    def read(self, storage_key: str) -> bytes:
        return self._safe_path(storage_key).read_bytes()

    def path(self, storage_key: str) -> Path:
        return self._safe_path(storage_key)

    def delete(self, storage_key: str) -> None:
        self._safe_path(storage_key).unlink(missing_ok=True)


@lru_cache(maxsize=1)
def get_document_storage() -> LocalDocumentStorage:
    return LocalDocumentStorage(settings.document_upload_dir)
