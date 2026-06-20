# FloodLens

FloodLens is a flood-risk intelligence and MLOps platform for Sri Lanka. It turns
model predictions, environmental signals, monitored locations, and prediction
logs into district-level decisions, emergency priorities, explanations, and
action recommendations.

The product goal is not to be a CSV map or a notebook demo. FloodLens is a
production-shaped prototype of an operational flood-risk decision-support
system.

> Flood risk prediction, explanation, and response prioritization for Sri Lanka.

## Project Documents

- [Technical architecture and MLOps document](docs/floodlens_technical_document.md)
- [Product and business document](docs/floodlens_product_document.md)
- [Presentation slide content and demo script](docs/floodlens_presentation_content.md)
- [Zero-to-hero setup guide](docs/setup_guide.md)
- [100/100 readiness roadmap and progress tracker](docs/winning_roadmap.md)

## Product Positioning

FloodLens helps authorities, planners, insurers, logistics teams, and response
coordinators answer five practical questions:

- Which places are at higher flood risk?
- Why are those places risky?
- Which districts or assets should be prioritized first?
- What action should be considered next?
- What evidence from model outputs, monitoring signals, feedback, and uploaded
  documents supports that decision?

**FloodLens Intelligent Copilot** is a GPT-powered, tool-grounded assistant that
turns model scores, monitoring state, field feedback, drift signals, and
retrieved response documents into defensible operational briefs. It is
positioned as an intelligent Copilot, not as a generic GPT wrapper.

FloodLens is a decision-support system, not an official emergency alert system.
It should not claim live disaster authority unless connected to verified
real-time government, rainfall, river-gauge, or satellite data.

## Current Implementation

The repository already contains a working MLOps foundation:

- ML training/export pipeline under `ml/`
- saved inference artifact at `artifacts/flood-risk-v3/model_bundle.joblib`
- FastAPI backend under `backend/`
- Next.js + Tailwind + shadcn dashboard under `frontend/`
- JSONL prediction logging under `backend/logs/predictions.jsonl`
- model metadata and monitoring APIs
- interactive Sri Lanka map using MapLibre/mapcn
- monitored-place explorer with district filter, table, inspector, baseline
  risk, risk drivers, priority, and recommended action
- provider-backed district and priority intelligence
- batch model scoring with latest model score storage
- feedback capture and drift/retraining monitoring
- Scenario Lab for geofenced what-if assessment and PDF action reports
- OpenAI-powered Intelligent Copilot in the Next.js dashboard
- Knowledge Library for PDF, TXT, and Markdown response documents
- OpenAI embeddings with PostgreSQL/pgvector hybrid retrieval
- Copilot document search with page-level citations
- split dashboard component structure under `frontend/components/dashboard/`

Implemented backend APIs:

- `GET /health`
- `GET /model-info`
- `POST /predict`
- `POST /scenario/context`
- `POST /scenario/simulate`
- `POST /reports/action`
- `POST /batch-predict`
- `GET /monitoring/summary`
- `GET /monitoring/drift`
- `POST /feedback`
- `GET /feedback/summary`
- `GET /model-scores`
- `GET /districts`
- `GET /locations`
- `GET /locations/{record_id}/record`
- `GET /district-summary`
- `GET /high-risk-locations`
- `GET /emergency-priority`
- `POST /documents`
- `GET /documents`
- `GET /documents/summary`
- `POST /documents/search`
- `GET /documents/{document_id}`
- `GET /documents/{document_id}/file`
- `DELETE /documents/{document_id}`
- `POST /documents/{document_id}/reindex`

Current business layer:

- treats the competition CSV as a seed provider, not the final product data
  source
- preserves raw coordinates while using corrected district presentation
  coordinates for the map
- computes baseline risk before model prediction
- exposes risk drivers, operational priority, asset type, and recommended action
- keeps model-assisted scoring available through `POST /predict` and
  `POST /batch-predict`

## Current Code Analysis

The current backend has useful service boundaries:

- `PredictorService`: loads the saved ML bundle once and serves predictions.
- `PredictionLogService`: appends successful predictions to JSONL and returns
  monitoring summaries.
- `LocationService`: reads seed data, converts rows into business-facing
  monitored places, fixes map presentation coordinates, and computes baseline
  decision signals.
- `DecisionIntelligenceService`: aggregates district summaries, high-risk
  rankings, and emergency priority queues.
- `BatchScoringService`: scores visible or filtered monitored places through
  the saved ML bundle.
- `ModelScoreStore`: persists the latest model-assisted score per monitored
  place in a lightweight JSON store.
- `FeedbackService`: records human usefulness feedback, observed outcomes, and
  model/field disagreement.
- `DriftMonitoringService`: compares recently scored records against the seed
  reference distribution and produces retraining signals.
- document services: validate, store, extract, chunk, embed, index, retrieve,
  reindex, and delete operational knowledge sources.
- `SystemMonitoringService`: records route-level HTTP telemetry and exposes
  service reliability metrics for production-readiness evidence.

The frontend has been split into focused dashboard components:

- dark operational dashboard shell
- sidebar navigation
- metric cards
- risk explorer
- interactive map
- operational risk queue
- selected-place inspector
- prediction tester
- monitoring view
- District Command and Priority Queue views
- baseline versus model score comparison
- feedback controls for scored places
- feedback and drift cards in the monitoring view
- Knowledge Library with upload progress, filters, indexing status, reindex,
  delete, and document access
- cited document evidence in the Intelligent Copilot
- Model Operations system reliability cards for request volume, error rate,
  latency, indexing failures, and retrieval activity
- component modules under `frontend/components/dashboard/`

The most important remaining product gap is production hardening: deployed RAG
verification, retrieval-quality evaluation, complete CI/CD, durable background
workers, authentication, and final demo rehearsal.

## Winning Readiness Against Judging Criteria

FloodLens is already strong as a foundation, but the current implementation is
not yet complete enough to maximize every judging category. The remaining work
must convert the model-serving dashboard into a decision platform with
aggregation, prioritization, feedback, drift monitoring, and a grounded Copilot.

| Judging Area | Current Readiness | What Exists | Missing To Maximize Score |
| --- | --- | --- | --- |
| Scenario Understanding & Solution Design (20%) | Strong | Clear flood-risk decision-support product, monitored-place layer, recommended actions, district command views, limitations stated | Final demo story tied tightly to response planning |
| Technical Implementation (30%) | Strong | Feature engineering pipeline, ensemble model artifact, FastAPI serving, provider layer, decision APIs, batch scoring, frontend dashboard, tests | Richer evaluation/priority outputs and final polish |
| MLOps & Production Readiness (25%) | Strong | model bundle, metadata, API serving, prediction logs, batch scoring, feedback loop, drift summary, tests | CI/CD, Docker verification, retraining automation story |
| Innovation & Problem Solving (10%) | Strong | business risk drivers, operational priority, feedback/drift signals, grounded Copilot, and document RAG | retrieval-quality evidence and final demo polish |
| Viva Evaluation (15%) | Good but needs polish | architecture rationale and README positioning | final architecture diagram, demo script, trade-off notes, known limitation answers |

The highest-impact missing pieces are:

1. **RAG Verification and Evaluation**
   - verify the full flow against the deployed PostgreSQL/pgvector environment
   - measure retrieval relevance and citation correctness
   - test unsupported questions and prompt-injection resistance.

2. **Deployment and CI Evidence**
   - GitHub Actions
   - Docker Compose verification
   - architecture diagram and final demo flow
   - makes the project easy to defend in viva.

Completed high-impact pieces:

1. **Decision Intelligence APIs**
   - `GET /district-summary`
   - `GET /high-risk-locations`
   - `GET /emergency-priority`
   - proves that FloodLens supports district planning and emergency
     prioritization, not only one-location prediction.

2. **Dashboard Decision Views**
   - District Command view
   - High-Risk Locations panel
   - Emergency Priority Queue
   - gives judges a clear, usable workflow with minimal explanation.

3. **Batch Scoring**
   - `POST /batch-predict`
   - score many monitored places and store latest model-assisted score
   - proves realistic workload handling and gives monitoring richer events.

4. **FloodLens Intelligent Copilot**
   - OpenAI GPT-powered Copilot through the direct OpenAI provider
   - Vercel AI SDK streaming route in Next.js
   - AI Elements chat UI
   - tool calls to internal FloodLens APIs for district, priority, score,
     feedback, monitoring, and drift evidence.

5. **Knowledge Library and Document RAG**
   - upload and manage SOPs, policies, and field reports
   - OpenAI embeddings stored in PostgreSQL/pgvector
   - hybrid semantic and full-text retrieval
   - Copilot document-search tool with page-level citations.

## Ultimate UX Plan

FloodLens should feel like an operational command center: dense, calm,
trustworthy, and action-oriented. It should avoid marketing-page layouts,
oversized explanatory copy, AI gimmicks, and decorative visuals that do not help
decisions.

Primary navigation:

- Overview
- Risk Explorer
- District Command
- Priority Queue
- Monitoring
- Copilot

Top status strip:

- API health
- active model version
- monitored places
- predictions logged
- latest prediction time

Core dashboard surfaces:

- **Overview**: model status, prediction volume, high-risk count, average risk,
  latest activity.
- **Risk Explorer**: map + table + district/search filters + selected-place
  inspector.
- **District Command**: district ranking, average risk, high-risk locations,
  critical/elevated priority counts, dominant risk drivers.
- **Priority Queue**: ranked locations for response planning, based on risk,
  population density, evacuation distance, historical floods, and
  infrastructure weakness.
- **Location Inspector**: baseline score, model-assisted score, drivers,
  recommended action, raw vs corrected coordinates, model version.
- **Monitoring**: model version, prediction logs, risk distribution, top active
  districts, feedback, drift/retraining signal.
- **Copilot**: grounded assistant that answers from backend APIs, never from
  unsupported guesses.

UX rules:

- Put actions near decisions: `Predict selected`, `Generate report`, `Mark
  reviewed`, `Add feedback`.
- Show score + reason + action together.
- Use short labels instead of long explanatory paragraphs.
- Use map and tables for scanning; use inspector for details.
- Make the UI understandable without explaining the architecture on-screen.
- Keep risk colors meaningful: green/amber/rose only for risk state.

## Ultimate Technical Plan

FloodLens should be built as a provider-backed MLOps application:

```text
Next.js Dashboard
  -> FastAPI Backend
    -> Decision Intelligence Services
    -> Prediction Service
    -> Monitoring + Feedback Services
    -> Provider Layer
      -> Seed CSV Provider
      -> Future Database Provider
      -> Future Uploaded Asset Provider
      -> Future Weather/Hydrology Provider
    -> ML Inference Bundle
      -> artifacts/flood-risk-v3/model_bundle.joblib
```

Recommended backend services:

- `PredictionService`: single and batch prediction using the saved ML bundle.
- `MonitoredLocationProvider`: interface for assets/places independent of CSV.
- `SeedCsvLocationProvider`: current provider backed by `data/raw/test.csv`.
- `DecisionIntelligenceService`: district summary, high-risk ranking, emergency
  priority, report inputs.
- `MonitoringService`: prediction volume, model version, risk distribution,
  model health, feedback counters.
- `FeedbackService`: collect user feedback and observed outcomes.
- `CopilotService`: grounded LLM orchestration that calls internal APIs/tools.

Recommended API roadmap:

- `GET /district-summary`
- `GET /high-risk-locations`
- `GET /emergency-priority`
- `POST /batch-predict`
- `POST /feedback`
- `GET /monitoring/drift`
- `POST /copilot`
- `POST /reports/district`

Data model direction:

- `MonitoredAsset`
  - `asset_id`
  - `asset_type`
  - `district`
  - `place_name`
  - `latitude`
  - `longitude`
  - `population_density`
  - `rainfall_signals`
  - `river_distance`
  - `evacuation_distance`
  - `infrastructure_score`
  - `baseline_risk`
  - `model_risk`
  - `priority`
  - `drivers`
  - `recommended_action`

MLOps direction:

- saved model artifact with metadata
- reproducible train/export pipeline
- API-serving tests
- frontend lint/build checks
- prediction logs
- feedback logs
- drift checks
- batch scoring
- model card
- CI/CD
- Docker Compose

## Winning Roadmap

Build order matters. The next work should maximize visible business value while
also improving architecture and MLOps depth.

### Phase 1: Provider-Backed Decision Intelligence — Complete

Implemented:

- introduce a provider interface so backend logic no longer depends directly on
  CSV internals
- keep the current CSV implementation as `SeedCsvLocationProvider`
- add `DecisionIntelligenceService`
- add:
  - `GET /district-summary`
  - `GET /high-risk-locations`
  - `GET /emergency-priority`
- update frontend with:
  - District Command view
  - High-Risk Locations panel
  - Emergency Priority Queue

Why this matters:

- visible business value for judges
- better technical architecture
- grounded data foundation for the Copilot
- turns prediction into prioritization

Acceptance criteria status:

- `/district-summary` returns district count, average baseline risk, high-risk
  count, critical/elevated priority count, and top drivers.
- `/high-risk-locations` returns a sorted list with score, level, priority,
  drivers, and recommended action.
- `/emergency-priority` ranks places by risk, population density, evacuation
  distance, historical floods, and infrastructure weakness.
- frontend shows District Command and Priority Queue without relying on long
  explanatory text.
- backend tests cover sorting, filtering, and empty/default behavior.

### Phase 2: Batch Scoring — Complete

Implemented:

- `POST /batch-predict`
- score filtered monitored places or explicit visible `record_ids`
- persist latest model score per location in a lightweight store
- expose latest scores with `GET /model-scores`
- show model score vs baseline score
- update district and priority views from scored results
- source-aware monitoring for single versus batch predictions

Why this matters:

- stronger MLOps story than one-row prediction
- shows the system can support planning workflows
- creates richer monitoring data

Acceptance criteria status:

- `POST /batch-predict` accepts district, limit, and explicit `record_ids`.
- the API returns per-location model score, risk level, and model version.
- batch predictions are logged with source `batch`.
- frontend can run batch scoring for visible District Command and Priority Queue
  rows.
- monitoring summary includes single vs batch prediction counts.

### Phase 3: Feedback and Monitoring Upgrade — Complete

Implemented:

- `POST /feedback`
- `GET /feedback/summary`
- `GET /monitoring/drift`
- file-based feedback events in `backend/logs/feedback.jsonl`
- useful/not useful prediction feedback
- observed outcome capture: flooded, no flood, or unknown
- disagreement detection when observed outcomes contradict high/low model risk
- retraining candidate status from feedback disagreement or drift thresholds
- dashboard feedback controls in Risk Explorer and Prediction views
- monitoring cards for feedback volume, disagreement rate, drift status, and
  feature warnings

Why this matters:

- hits MLOps judging criteria directly
- shows the model lifecycle, not just model serving
- creates a clear retraining story

Acceptance criteria status:

- `POST /feedback` records record ID, model version, user feedback, optional
  observed outcome, and timestamp.
- monitoring shows feedback count, disagreement count, and retraining candidate
  status.
- drift summary compares recent prediction input ranges/distributions against
  reference training/test data.
- failures return clear API errors and do not corrupt logs.
- backend tests cover feedback writes, validation failures, summary counts,
  retraining candidate status, and drift summaries.

### Phase 4A: FloodLens Intelligent Copilot — Complete

Implemented the final intelligence layer after the decision APIs, batch scoring,
feedback loop, and drift monitoring.

Positioning:

> FloodLens Intelligent Copilot is a GPT-powered assistant that turns model
> predictions, monitoring logs, field feedback, drift signals, and uploaded
> flood-response documents into grounded operational recommendations.

This is not positioned as a generic chatbot. It is a Copilot for flood-risk
operations that must use FloodLens evidence before answering.

Supported questions:

- Which districts are highest risk?
- Why is this location risky?
- Which places should emergency teams prioritize?
- Compare Colombo and Kalutara.
- Generate a district flood-risk report.
- Summarize model monitoring status.
- Is retraining needed based on feedback and drift?
- What evidence supports this recommendation?

Rules:

- Copilot must call backend tools/APIs before answering operational questions.
- Copilot must not invent live rainfall, official warnings, or evacuation orders.
- Copilot should say when data is seed/demo data.
- Copilot should produce decision-support language, not emergency authority.
- Copilot answers should include source facts from the backend.

Technical direction:

- Uses OpenAI GPT through `@ai-sdk/openai`; no Vercel AI Gateway.
- Uses Vercel AI SDK `ToolLoopAgent` and a Next.js streaming API route.
- Uses AI Elements for conversation, message, prompt input, suggestions,
  source display, and collapsible tool evidence.
- Keeps FastAPI as the ML and decision backend.
- Starts with tool-grounded answers from existing APIs.

Acceptance criteria status:

- Copilot supports predefined grounded intents first:
  - explain location
  - compare districts
  - list priority locations
  - generate district report
  - summarize monitoring status
  - summarize feedback and drift/retraining status
- Copilot responses include source data from the backend.
- unsupported questions receive safe limitation language.
- Copilot does not call the model directly when existing decision APIs already
  provide the required facts.

### Phase 4B: Document RAG Extension — Complete Locally

Implemented:

- uploaded PDFs/SOPs/field reports
- validation, duplicate detection, extraction, and token-aware chunking
- OpenAI embeddings and PostgreSQL/pgvector storage
- hybrid semantic and full-text retrieval
- Knowledge Library upload and lifecycle UI
- Copilot document-search tool and page-level citations
- focused document and retrieval tests
- synthetic retrieval fixture and Recall@5/MRR evaluation script

Remaining before final submission:

- deployed end-to-end pgvector verification
- live retrieval and grounded-answer metric capture against the final deployment
- durable ingestion workers, OCR, and production access controls

RAG is framed as a document intelligence extension, not as the source of model
predictions.

### Phase 4C: Scenario Lab and Action Reports — Complete

Implemented:

- Sri Lanka geofence validation for custom scenario points
- optional API-enhanced context enrichment with local fallback
- Scenario Lab dashboard view for monitored records and map-clicked points
- editable what-if assumptions for rainfall, elevation, river distance,
  evacuation distance, exposure, history, and infrastructure
- `POST /scenario/context` and `POST /scenario/simulate`
- scenario predictions logged with source `scenario`
- backend-generated PDF action reports through `POST /reports/action`

Scenario Lab is framed as controlled decision support. It does not claim live
rainfall, official warnings, or evacuation authority.

### Phase 5: Deployment and CI/CD Polish

Make the project reproducible:

- Docker Compose for backend/frontend
- GitHub Actions for:
  - backend tests
  - ML tests
  - frontend lint
  - frontend build
- deployment notes for frontend and backend
- architecture diagram
- model card
- demo script

Why this matters:

- proves engineering maturity
- makes viva answers easy
- demonstrates production readiness

Acceptance criteria:

- GitHub Actions runs backend tests, ML tests, frontend lint, and frontend build.
- Docker Compose starts backend and frontend locally.
- README demo commands are current.
- architecture and demo docs match the implemented system.
- final demo can be completed in under five minutes.

## Recommended Demo Flow

1. Open FloodLens dashboard.
2. Show overview: model version, API health, logged predictions, monitored
   places.
3. Open Risk Explorer and filter one district.
4. Select a monitored place.
5. Show baseline risk, drivers, operational priority, and recommended action.
6. Run model prediction for that place.
7. Submit useful/not useful feedback and, when available, an observed outcome.
8. Show monitoring count, feedback count, disagreement rate, and drift status.
9. Open District Command and show district-level risk comparison.
10. Run batch scoring for a district and show model score versus baseline risk.
11. Open Priority Queue and show the response-planning ranking.
12. Open Knowledge Library, upload or show an indexed SOP, and confirm its
    ready status.
13. Ask FloodLens Intelligent Copilot:
    - "Why is this location risky?"
    - "Which places should be prioritized first?"
    - "Is retraining needed based on feedback and drift?"
    - "Generate a district action brief using the current model and monitoring
      evidence."
14. Ask one document-grounded action question and open its page citation.
15. End on MLOps monitoring: logs, model version, feedback, drift/retraining
    path.

Best judging line:

> FloodLens is not just a flood-risk model or a dashboard. It is an intelligent
> flood-risk operating system where predictive ML, MLOps monitoring, feedback,
> drift checks, and a GPT-powered grounded Copilot work together to support
> defensible response planning.

## Local Development

For a full teammate setup from a fresh clone, including GitHub Release
artifacts, Python environments, frontend variables, verification commands, and
troubleshooting, use:

- [Zero-to-hero setup guide](docs/setup_guide.md)

Place `train.csv` and `test.csv` under `data/raw/`.

Run ML tests:

```bash
cd ml
.venv/bin/python -m pytest tests -q
```

Run backend tests:

```bash
PYTHONPATH=backend ml/.venv/bin/python -m pytest backend/tests -q
```

Start backend:

```bash
OPENAI_API_KEY=replace-with-your-openai-api-key \
  docker compose -f infra/docker-compose.yml up --build db backend
```

This starts PostgreSQL/pgvector, runs Alembic migrations, and starts FastAPI.
The backend uses the OpenAI key for document embeddings. Next.js uses the same
key server-side for Copilot streaming; never prefix it with `NEXT_PUBLIC_`.

Start frontend:

```bash
cd frontend
pnpm dev
```

Frontend default backend URL:

```text
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
OPENAI_API_KEY=replace-with-your-openai-api-key
OPENAI_MODEL=gpt-5.5
NEXT_PUBLIC_OPENAI_MODEL_LABEL=gpt-5.5
SCENARIO_EXTERNAL_ENRICHMENT=false
SCENARIO_CONTEXT_TIMEOUT_S=3
```

Run frontend checks:

```bash
cd frontend
pnpm lint
pnpm build
```

Train/export model:

```bash
cd ml
source .venv/bin/activate
python pipelines/train_pipeline.py --notes "flood-risk-v3 foundation"
```

The exported inference bundle is written to:

```text
artifacts/flood-risk-v3/model_bundle.joblib
```

## Current Limitations

- Current monitored-place data comes from the seed competition CSV.
- Corrected map coordinates are district-level presentation coordinates, not
  verified surveyed asset coordinates.
- The product is not connected to live rainfall, river-gauge, satellite, or
  official emergency feeds yet.
- JSONL logging is used for speed; database-backed storage should come later.
- document ingestion uses local storage and FastAPI background tasks; production
  requires object storage and durable workers.
- the Knowledge Library is a single workspace without authentication in the
  hackathon build.
- scanned PDFs require OCR, which is not implemented yet.
- FloodLens is decision support, not an official alerting system.
