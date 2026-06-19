#!/usr/bin/env python3
"""Evaluate FloodLens document retrieval against a small cited fixture set."""

import argparse
import json
import time
from pathlib import Path

import httpx


FIXTURE_DIR = Path(__file__).resolve().parents[1] / "backend" / "tests" / "fixtures" / "rag"


def upload_fixtures(client: httpx.Client, config: dict) -> None:
    for document in config["documents"]:
        path = FIXTURE_DIR / document["file"]
        with path.open("rb") as source:
            response = client.post(
                "/documents",
                files={"file": (path.name, source, "text/markdown")},
                data={
                    "title": document["title"],
                    "document_type": document["document_type"],
                    "district": document["district"],
                },
            )
        if response.status_code == 409:
            document_id = response.json()["detail"]["existing_document_id"]
        else:
            response.raise_for_status()
            document_id = response.json()["id"]
        for _ in range(60):
            status = client.get(f"/documents/{document_id}")
            status.raise_for_status()
            state = status.json()["status"]
            if state == "ready":
                break
            if state == "failed":
                raise RuntimeError(status.json()["failure_message"])
            time.sleep(1)
        else:
            raise TimeoutError(f"Indexing timed out for {path.name}")


def evaluate(client: httpx.Client, config: dict) -> tuple[float, float]:
    hits = 0
    reciprocal_rank = 0.0
    for item in config["queries"]:
        response = client.post(
            "/documents/search", json={"query": item["query"], "limit": 5}
        )
        response.raise_for_status()
        titles = [result["title"] for result in response.json()["results"]]
        try:
            rank = titles.index(item["expected_title"]) + 1
        except ValueError:
            rank = None
        if rank:
            hits += 1
            reciprocal_rank += 1 / rank
        print(f"query={item['query']!r} expected={item['expected_title']!r} rank={rank}")
    total = len(config["queries"])
    return hits / total, reciprocal_rank / total


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--upload-fixtures", action="store_true")
    args = parser.parse_args()
    config = json.loads((FIXTURE_DIR / "evaluation.json").read_text())

    with httpx.Client(base_url=args.base_url, timeout=60) as client:
        if args.upload_fixtures:
            upload_fixtures(client, config)
        recall, mrr = evaluate(client, config)
    print(f"Recall@5={recall:.3f} MRR={mrr:.3f}")


if __name__ == "__main__":
    main()
