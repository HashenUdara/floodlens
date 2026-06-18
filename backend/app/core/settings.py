"""Backend settings and repository path resolution."""

from pathlib import Path


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


settings = Settings()
