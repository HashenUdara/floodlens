"""Backend settings and repository path resolution."""

import os
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def normalize_database_url(url: str | None) -> str | None:
    if not url:
        return None
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    return url


def find_repo_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "ml").exists() and (parent / "artifacts").exists():
            return parent
    return Path(__file__).resolve().parents[3]


class Settings:
    service_name = "floodlens-api"
    repo_root = find_repo_root()
    ml_root = repo_root / "ml"
    model_bundle_path = repo_root / "artifacts" / "flood-risk-v3" / "model_bundle.joblib"
    model_metadata_path = repo_root / "artifacts" / "flood-risk-v3" / "metadata.json"
    test_data_path = repo_root / "data" / "raw" / "test.csv"
    backend_log_dir = repo_root / "backend" / "logs"
    prediction_log_path = backend_log_dir / "predictions.jsonl"
    latest_scores_path = backend_log_dir / "latest_scores.json"
    feedback_log_path = backend_log_dir / "feedback.jsonl"
    database_url = normalize_database_url(os.getenv("DATABASE_URL"))
    openai_api_key = os.getenv("OPENAI_API_KEY")
    openai_embedding_model = os.getenv(
        "OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"
    )
    embedding_dimensions = 1536
    document_upload_dir = Path(
        os.getenv("DOCUMENT_UPLOAD_DIR", str(repo_root / "backend" / "uploads"))
    )
    max_document_size_mb = int(os.getenv("MAX_DOCUMENT_SIZE_MB", "20"))
    max_upload_files = int(os.getenv("MAX_UPLOAD_FILES", "5"))
    public_api_base_url = os.getenv(
        "PUBLIC_API_BASE_URL", "http://127.0.0.1:8000"
    ).rstrip("/")


settings = Settings()
