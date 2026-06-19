# FloodLens Setup Guide

This guide is for teammates who clone the repo and download the model/data
artifacts from GitHub Releases.

The repo keeps generated artifacts out of git. Code is in GitHub. Model/data
files are distributed separately as a release asset.

## 1. Prerequisites

Install these first:

- Git
- Python 3.11
- Node.js 20 or newer
- pnpm

Recommended pnpm install:

```bash
npm install -g pnpm
```

macOS only: LightGBM needs OpenMP. If you see `Library not loaded:
libomp.dylib`, install:

```bash
brew install libomp
```

## 2. Clone The Repo

```bash
git clone <YOUR_REPO_URL>
cd floodly
```

Replace `<YOUR_REPO_URL>` with the team GitHub repository URL.

## 3. Download Release Artifacts

Download the latest artifact zip from GitHub Releases.

Expected release asset name:

```text
floodlens-artifacts.zip
```

The zip should contain this exact structure:

```text
data/
  raw/
    train.csv
    test.csv

artifacts/
  flood-risk-v3/
    model_bundle.joblib
    metadata.json
```

Unzip it into the repo root:

```bash
unzip floodlens-artifacts.zip -d .
```

Then verify:

```bash
ls data/raw/train.csv
ls data/raw/test.csv
ls artifacts/flood-risk-v3/model_bundle.joblib
ls artifacts/flood-risk-v3/metadata.json
```

If any file is missing, backend prediction will not work.

## 4. Create ML Python Environment

The ML environment is also used to run backend tests because it contains the
model runtime libraries.

```bash
cd ml
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cd ..
```

If your command is `python3` instead of `python3.11`, use:

```bash
python3 -m venv ml/.venv
```

## 5. Create Backend Environment

The backend can run with its own virtual environment, but for this project the
fastest local setup is to run the backend using `ml/.venv` because the saved
model needs LightGBM, XGBoost, CatBoost, scikit-learn, pandas, and joblib.

Install backend dependencies into `ml/.venv`:

```bash
ml/.venv/bin/pip install -r backend/requirements.txt
```

Optional separate backend environment:

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cd ..
```

If you use `backend/.venv`, make sure it has the ML runtime libraries from
`backend/requirements.txt`.

## 6. Install Frontend Dependencies

```bash
cd frontend
pnpm install
cd ..
```

Create or confirm the frontend environment file:

```bash
cat > frontend/.env.local <<'EOF'
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
EOF
```

This tells the Next.js dashboard where the FastAPI backend is running.

## 7. Verify The Setup

Run backend tests:

```bash
PYTHONPATH=backend ml/.venv/bin/python -m pytest backend/tests -q
```

Run ML tests:

```bash
cd ml
.venv/bin/python -m pytest tests -q
cd ..
```

Run frontend checks:

```bash
cd frontend
pnpm lint
pnpm build
cd ..
```

Expected result:

- backend tests pass
- ML tests pass
- frontend lint passes
- frontend build passes

## 8. Start The App

Terminal 1: start backend.

```bash
cd backend
../ml/.venv/bin/uvicorn app.main:app --reload
```

Backend URL:

```text
http://127.0.0.1:8000
```

Check backend:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/model-info
```

Terminal 2: start frontend.

```bash
cd frontend
pnpm dev
```

Frontend URL:

```text
http://127.0.0.1:3000
```

Open the frontend in your browser.

## 9. Demo Flow

Use this flow to confirm the product works:

1. Open `http://127.0.0.1:3000`.
2. Confirm API status is online.
3. Open `Risk Explorer`.
4. Select a district.
5. Select a monitored place on the map or table.
6. Click `Predict selected`.
7. Open `District Command`.
8. Select a district.
9. Click `Run batch scoring`.
10. Confirm the table shows `Baseline` and `Model` risk labels.
11. Open `Priority Queue`.
12. Confirm model-scored counts update.
13. Open `Model Operations`.
14. Confirm single and batch prediction counts are visible.

## 10. Useful API Commands

Health:

```bash
curl http://127.0.0.1:8000/health
```

Model info:

```bash
curl http://127.0.0.1:8000/model-info
```

Districts:

```bash
curl http://127.0.0.1:8000/districts
```

Batch score one district:

```bash
curl -X POST http://127.0.0.1:8000/batch-predict \
  -H "Content-Type: application/json" \
  -d '{"district":"Colombo","limit":25}'
```

Latest model scores:

```bash
curl "http://127.0.0.1:8000/model-scores?district=Colombo&limit=25"
```

Monitoring summary:

```bash
curl http://127.0.0.1:8000/monitoring/summary
```

## 11. Generated Files

These files are intentionally not committed:

```text
data/raw/train.csv
data/raw/test.csv
data/processed/*
data/versioned/*
artifacts/flood-risk-v3/model_bundle.joblib
artifacts/flood-risk-v3/metadata.json
backend/logs/*
ml/.venv/
backend/.venv/
frontend/node_modules/
frontend/.next/
```

Why:

- datasets and model bundles are artifacts, not source code
- logs change during every demo
- virtual environments and build output are machine-specific

## 12. Rebuilding The Model Artifact

If you do not have the release artifact, you can rebuild it from raw data.

Required files:

```text
data/raw/train.csv
data/raw/test.csv
```

Run:

```bash
cd ml
source .venv/bin/activate
python pipelines/train_pipeline.py --notes "flood-risk-v3 local rebuild"
cd ..
```

Expected output:

```text
artifacts/flood-risk-v3/model_bundle.joblib
artifacts/flood-risk-v3/metadata.json
```

## 13. Troubleshooting

### Backend: `model_bundle.joblib` not found

You did not unzip the release artifact into the repo root.

Fix:

```bash
ls artifacts/flood-risk-v3/model_bundle.joblib
```

If it is missing, download and unzip `floodlens-artifacts.zip` again.

### Backend: `test.csv` not found

The seed provider needs:

```text
data/raw/test.csv
```

Fix:

```bash
ls data/raw/test.csv
```

### macOS: `libomp.dylib` error

Install OpenMP:

```bash
brew install libomp
```

Then restart the backend.

### Frontend: API offline

Make sure backend is running:

```bash
curl http://127.0.0.1:8000/health
```

Make sure `frontend/.env.local` contains:

```text
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

Restart `pnpm dev` after changing `.env.local`.

### Port already in use

Backend:

```bash
cd backend
../ml/.venv/bin/uvicorn app.main:app --reload --port 8001
```

Then update `frontend/.env.local`:

```text
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001
```

Frontend:

```bash
cd frontend
pnpm dev -- --port 3001
```

### pnpm missing

Install:

```bash
npm install -g pnpm
```

### Python package install fails

Upgrade pip first:

```bash
ml/.venv/bin/python -m pip install --upgrade pip setuptools wheel
```

Then retry:

```bash
ml/.venv/bin/pip install -r ml/requirements.txt
ml/.venv/bin/pip install -r backend/requirements.txt
```

## 14. Release Checklist For Maintainers

Before creating a GitHub Release, package artifacts from repo root:

```bash
zip -r floodlens-artifacts.zip \
  data/raw/train.csv \
  data/raw/test.csv \
  artifacts/flood-risk-v3/model_bundle.joblib \
  artifacts/flood-risk-v3/metadata.json
```

Upload `floodlens-artifacts.zip` to the latest GitHub Release.

Do not include:

```text
backend/logs/
frontend/.next/
frontend/node_modules/
ml/.venv/
backend/.venv/
__pycache__/
```
