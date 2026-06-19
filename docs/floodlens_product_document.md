# FloodLens Product and Business Document

## 1. Executive Summary

FloodLens is a flood-risk intelligence and MLOps platform designed for Sri
Lankan authorities, emergency coordinators, infrastructure operators,
logistics teams, insurers, and organizations responsible for exposed assets.

It combines predictive flood-risk scoring, district and location prioritization,
interactive geospatial exploration, model monitoring, field feedback, drift
detection, and a GPT-powered grounded Copilot. The final product also includes
a document knowledge layer for response SOPs, policies, and field reports.

The core business outcome is simple:

> Help operational teams identify where attention is needed, understand why,
> decide what to review first, and defend that decision with traceable evidence.

FloodLens is not an official warning system. It is a decision-support layer that
can be integrated with verified real-time sources and formal emergency workflows.

## 2. The Problem

Flood-risk decisions are often fragmented across spreadsheets, model outputs,
maps, reports, local knowledge, and manual communication. Even when an accurate
model exists, operational teams still face several gaps:

- predictions are difficult to translate into response priorities;
- district and asset comparisons require manual work;
- the reason behind a score may be unclear;
- prediction history and model versions are not consistently tracked;
- observed outcomes do not reliably return to the model lifecycle;
- response SOPs and field reports are disconnected from risk dashboards;
- decision makers need concise briefs, not raw feature tables;
- data quality, geographic accuracy, and freshness may be uncertain.

A notebook or static map does not solve these operational problems. FloodLens
is designed around the decision workflow that begins after a model produces a
score.

## 3. Product Vision

FloodLens becomes the operating layer between flood data, predictive models,
response knowledge, and human decisions.

```text
Data and observations
        -> Risk estimation
        -> District and asset prioritization
        -> Operational review and action
        -> Human feedback and observed outcomes
        -> Monitoring and retraining decisions
```

Long-term product vision:

> A trusted flood-risk operating system that continuously combines verified
> environmental signals, exposed assets, predictive ML, operational feedback,
> and response knowledge for defensible planning.

## 4. Target Users and Buyers

### Government and emergency management

Users:

- district disaster-management coordinators;
- emergency operations centers;
- municipal and provincial planners;
- public-works and drainage teams.

Value:

- compare district exposure;
- rank communities and assets for review;
- connect risks to response procedures;
- document evidence behind planning decisions.

### Infrastructure and utility operators

Users:

- road and transport operators;
- electricity, water, and telecommunications teams;
- hospitals, schools, and public-facility operators.

Value:

- monitor critical facilities and routes;
- identify vulnerable infrastructure;
- prioritize inspections and continuity planning;
- produce asset-level action briefs.

### Insurance and financial services

Users:

- underwriting and portfolio-risk teams;
- claims and catastrophe-response teams;
- risk analysts and reinsurers.

Value:

- segment portfolios by flood exposure;
- compare baseline and model-assisted risk;
- prioritize field assessments;
- retain model-version and evidence trails.

### Logistics, retail, and industrial operations

Users:

- warehouse and distribution managers;
- supply-chain risk teams;
- business-continuity teams.

Value:

- identify exposed sites and routes;
- prioritize contingency actions;
- combine internal SOPs with current risk evidence;
- reduce manual analysis time.

## 5. Core User Questions

FloodLens is organized around seven operational questions:

1. Which districts currently require attention?
2. Which monitored places or assets are most exposed?
3. Why is a location considered risky?
4. Which locations should be reviewed first when capacity is limited?
5. What does the model say compared with the transparent baseline?
6. Is the model still behaving reliably?
7. What actions are supported by our operational documents and current evidence?

## 6. Product Capabilities

### Overview

Purpose: establish operational status immediately.

Users can see API health, model version, feature count, prediction activity,
average risk, high-risk counts, and recent model operations.

Business value: decision makers know whether the system is available, which
model is active, and whether recent scoring activity exists before relying on
the dashboard.

### Risk Explorer

Purpose: investigate monitored locations spatially and in a table.

Users can filter by district, search by place or record, select map markers or
table rows, inspect environmental context, view baseline risk and drivers, run
a model prediction, and record feedback.

Business value: analysts move from portfolio scanning to a specific place
without switching tools.

### District Command

Purpose: compare districts for planning and resource allocation.

Users can compare monitored-place counts, average baseline risk, high-risk
counts, elevated/critical priorities, dominant drivers, and the number of
locations with current model scores. They can run bounded district batch
scoring.

Business value: regional leadership can allocate review capacity using a
consistent portfolio view.

### Priority Queue

Purpose: determine review order when resources are constrained.

Locations are ranked using risk, population exposure, evacuation access,
historical flooding, and infrastructure weakness. The queue presents reasons
and a recommended next action.

Business value: flood risk becomes an actionable worklist rather than a passive
score.

### Prediction Workspace

Purpose: test or score a complete record using the deployed model artifact.

Users can edit a full input record, submit it for inference, inspect the score,
risk level, record ID, and model version, then provide usefulness and outcome
feedback.

Business value: provides a transparent validation and analyst workflow for new
or corrected records.

### Monitoring

Purpose: assess model use and reliability.

Users can review prediction volume, batch activity, risk distribution, active
model versions, feedback volume, disagreement rate, feature-shift warnings,
and retraining-candidate status.

Business value: managers can distinguish a working dashboard from an actively
governed ML service.

### Intelligent Copilot

Purpose: turn multiple FloodLens signals into concise operational answers.

The Copilot calls FloodLens tools for district, location, priority, model,
monitoring, feedback, and drift facts before answering. It can compare
districts, explain a record, summarize operations, assess retraining evidence,
and generate district action briefs.

Business value: reduces the time and technical knowledge required to synthesize
multiple dashboard views while preserving source evidence.

### Knowledge Library and Document RAG

Purpose: connect flood-response knowledge with current operational evidence.

The final workflow supports uploading SOPs, policies, field reports, and other
approved documents; indexing them; filtering by district and document type;
retrieving relevant sections; and showing page-level citations in Copilot
answers.

Business value: recommendations are aligned with an organization's own approved
procedures instead of relying only on generic language.

## 7. Primary Business Workflows

### Workflow A: District planning

1. Open District Command.
2. Compare average risk, high-risk counts, and priority counts.
3. Select a district.
4. Run batch model scoring for the visible scope.
5. Review baseline versus model-assisted scores.
6. Open the highest-priority places.
7. Ask the Copilot for a district action brief.
8. Export or communicate the reviewed actions.

### Workflow B: Location investigation

1. Search for a location in Risk Explorer.
2. Inspect exposure context and risk drivers.
3. Run model scoring.
4. Compare the transparent baseline with the model score.
5. Review the recommended action and priority reasons.
6. Submit usefulness feedback or an observed outcome.
7. Escalate the location into an operational review process.

### Workflow C: Model-operations review

1. Open Monitoring.
2. Confirm active model version and prediction activity.
3. Review risk distribution and recent batch runs.
4. Inspect feedback disagreement and drift warnings.
5. Ask the Copilot whether retraining evidence exists.
6. Approve further data investigation or retraining outside the dashboard.

### Workflow D: SOP-grounded response brief

1. Upload an approved district SOP or field report.
2. Wait for indexing status `ready`.
3. Ask for a district or location action brief.
4. Copilot retrieves FloodLens risk evidence and relevant document sections.
5. Review the answer, source document, and page citations.
6. A human decision maker approves or rejects the proposed actions.

## 8. Decision Model

FloodLens separates four related but different signals:

| Signal | Meaning | Used for |
| --- | --- | --- |
| Baseline risk | Transparent heuristic from visible context | Immediate ranking and explainability |
| Model-assisted risk | ML ensemble prediction using full feature contract | Predictive assessment |
| Operational priority | Business ranking that includes exposure and response difficulty | Work ordering and resource planning |
| Copilot recommendation | LLM synthesis of structured tools and approved documents | Briefing and interpretation |

This separation is a product-strength feature. It prevents a single model score
from silently becoming an operational order.

## 9. Differentiation

FloodLens is differentiated from a conventional prediction dashboard by:

- provider-backed architecture rather than hard-coded CSV UI logic;
- district and emergency-priority workflows;
- baseline versus model-assisted score transparency;
- batch scoring and versioned latest scores;
- prediction logging and model-operation summaries;
- field feedback and observed-outcome disagreement;
- drift and retraining indicators;
- tool-grounded Copilot rather than a generic chatbot;
- hybrid document retrieval with page-level evidence;
- explicit separation between decision support and emergency authority.

## 10. Business Value

### Faster analysis

District comparison, location investigation, model scoring, and evidence
synthesis happen in one workspace instead of across notebooks, spreadsheets,
maps, and PDFs.

### Better prioritization

Teams can rank work using risk plus exposure, evacuation access, history, and
infrastructure weakness rather than a score alone.

### Defensible decisions

Model version, score source, risk drivers, feedback, drift state, and document
citations create an evidence trail for review.

### Closed operational feedback loop

Observed outcomes and usefulness feedback return to model monitoring and
retraining decisions.

### Extensible data foundation

Provider contracts allow organizations to replace seed data with their own
assets and verified environmental feeds while retaining the same user
experience.

## 11. Success Metrics

### Product adoption

- weekly active operational users;
- districts or asset portfolios monitored;
- locations reviewed per planning cycle;
- percentage of high-priority locations acknowledged.

### Decision efficiency

- time from data availability to prioritized worklist;
- time to prepare a district action brief;
- percentage of recommendations reviewed within SLA;
- reduction in manual spreadsheet/report preparation.

### Model and data quality

- MAE/RMSE on verified observed outcomes;
- calibration and performance by district and asset type;
- prediction failure and missing-data rates;
- drift-warning frequency and resolution time;
- feedback disagreement rate.

### Copilot and RAG quality

- grounded-answer rate;
- citation correctness and retrieval relevance;
- unsupported-claim rate;
- user usefulness rating;
- average response latency and cost.

### Operational outcomes

- percentage of priority locations receiving follow-up;
- inspection or mitigation actions initiated;
- continuity-plan coverage for critical assets;
- avoided delay in planning and response coordination.

FloodLens should not claim reduced flood damage until validated through a
controlled operational study.

## 12. Product Scope and Status

### Implemented

- ML training, evaluation, artifact export, and reusable inference;
- single and batch FastAPI scoring;
- monitored-location provider abstraction;
- Risk Explorer, map, filters, table, and location inspector;
- District Command and Priority Queue;
- baseline risk, drivers, priority, and recommended actions;
- prediction logs, latest model scores, monitoring summaries;
- usefulness feedback, observed outcomes, disagreement, and drift signals;
- direct-OpenAI, tool-grounded Intelligent Copilot.

### Implemented document intelligence

- document upload and lifecycle APIs;
- local file storage and duplicate detection;
- PDF/TXT/Markdown extraction and chunking;
- OpenAI embeddings;
- PostgreSQL/pgvector schema and Alembic migration;
- hybrid semantic/full-text retrieval;
- Knowledge Library with upload progress, status, filters, reindex, delete, and
  document access;
- Copilot document-search tool and page-level citation rendering;
- focused document extraction, validation, storage, and retrieval tests.

### Planned before final submission

- deployed PostgreSQL/pgvector RAG verification and retrieval evaluation dataset;
- complete local container stack and CI pipeline;
- final deployment, telemetry, and demo hardening;
- exportable district/action report.

### Future production roadmap

- organization accounts, roles, and audit workflow;
- database and uploaded-asset providers;
- verified weather, river-gauge, satellite, and official alert integrations;
- durable task queues and high-volume batch scoring;
- notification and incident-management integrations;
- scheduled retraining, model registry, canary rollout, and rollback;
- mobile field feedback and offline capture;
- multilingual Sinhala, Tamil, and English experience.

## 13. Go-to-Market Direction

### Initial entry point

Start with a bounded pilot for one organization and a small set of districts or
critical assets. The pilot should focus on planning and review rather than
automatic emergency action.

### Pilot package

- import or connect monitored assets;
- configure verified environmental inputs;
- establish baseline and model scoring;
- upload approved SOPs;
- train operational users;
- measure decision-preparation time and feedback quality;
- review model performance against observed outcomes.

### Commercial models

- annual organization license by monitored asset volume;
- managed deployment and integration package;
- insurer or enterprise portfolio analytics tier;
- government/NGO program deployment with implementation support;
- API access for partner applications.

Final pricing requires customer discovery, infrastructure-cost measurement,
and data-provider licensing analysis.

## 14. Responsible Use and Limitations

Current limitations must remain visible in product and presentation material:

- the current location dataset is seed competition data;
- presentation coordinates are corrected district-level map coordinates, not
  verified surveyed locations;
- the system does not currently consume live rainfall, river, satellite, or
  official warning data;
- risk and priority scores are decision support, not evacuation orders;
- field outcomes are required for production performance validation;
- LLM answers may only synthesize approved tools and documents and require
  human review;
- uploaded document access must be secured before multi-organization use.

## 15. Final Product Narrative

FloodLens begins with a strong flood-risk ensemble, but its product value comes
from the complete operational loop:

> ingest and validate data, estimate risk, compare districts, prioritize places,
> explain the evidence, capture human outcomes, monitor drift, determine when
> retraining is justified, and generate grounded action briefs using approved
> operational knowledge.

That combination maximizes both technical MLOps value and real business value.
