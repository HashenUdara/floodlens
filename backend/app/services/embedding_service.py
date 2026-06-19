"""OpenAI embedding provider used by ingestion and retrieval."""

from functools import lru_cache
from typing import Protocol, runtime_checkable

from openai import OpenAI

from app.core.settings import settings


class EmbeddingConfigurationError(RuntimeError):
    pass


@runtime_checkable
class EmbeddingProvider(Protocol):
    model_name: str

    def embed_texts(self, texts: list[str]) -> list[list[float]]: ...

    def embed_query(self, text: str) -> list[float]: ...


class OpenAIEmbeddingProvider:
    def __init__(self, api_key: str | None, model_name: str, dimensions: int):
        self.api_key = api_key
        self.model_name = model_name
        self.dimensions = dimensions

    def _client(self) -> OpenAI:
        if not self.api_key:
            raise EmbeddingConfigurationError(
                "OPENAI_API_KEY is required to index and search documents."
            )
        return OpenAI(api_key=self.api_key)

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        embeddings: list[list[float]] = []
        client = self._client()
        for start in range(0, len(texts), 96):
            response = client.embeddings.create(
                model=self.model_name,
                input=texts[start : start + 96],
                dimensions=self.dimensions,
            )
            embeddings.extend(item.embedding for item in response.data)
        return embeddings

    def embed_query(self, text: str) -> list[float]:
        return self.embed_texts([text])[0]


@lru_cache(maxsize=1)
def get_embedding_provider() -> OpenAIEmbeddingProvider:
    return OpenAIEmbeddingProvider(
        api_key=settings.openai_api_key,
        model_name=settings.openai_embedding_model,
        dimensions=settings.embedding_dimensions,
    )
