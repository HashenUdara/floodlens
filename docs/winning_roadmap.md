# FloodLens 100/100 Readiness Roadmap

This document tracks the remaining work required to maximize FloodLens against
the official ML Opsidian: Genesis final-round judging criteria. A perfect score
cannot be guaranteed because judging is subjective, but completing every gate
below closes the known technical, MLOps, submission, demo, and viva gaps.

## Progress Dashboard

| Judging area | Weight | Current state | Target |
| --- | ---: | --- | --- |
| Scenario Understanding and Solution Design | 20% | Strong | Clear problem, constraints, users, architecture, and business workflow |
| Technical Implementation | 30% | Strong with model-evidence gaps | Reproducible champion model with calibrated risk bands and comparison evidence |
| MLOps and Production Readiness | 25% | Strong with automation gaps | Complete CI, observability, retraining workflow, load evidence, and deployment proof |
| Innovation and Problem Solving | 10% | Strong | Evaluated document RAG and defensible engineering trade-offs |
| Viva Evaluation | 15% | Needs rehearsal and final assets | Every decision explained clearly with failure and adaptation scenarios |

## Stage 1: Model Credibility

Target: maximize Technical Implementation.

### Engineering

- [ ] Fix the Optuna tuning script return-value bug.
- [ ] Run and record a CatBoost-only baseline.
- [ ] Run and record the untuned ensemble.
- [ ] Run and record the tuned ensemble.
- [ ] Store every run in the experiment registry with configuration and notes.
- [ ] Select and publish one champion through the promotion gate.

### Comparison Evidence

- [ ] Produce a model comparison table with MAE, RMSE, prediction standard
  deviation, training time, and artifact version.
- [ ] Quantify the improvement from the Initial Round model to the final model.
- [ ] Compare each base model against the stacked ensemble.
- [ ] Explain why the Ridge meta-model weighting is defensible.

### Risk Calibration

- [ ] Analyze the out-of-fold prediction distribution.
- [ ] Confirm why the exported test range currently does not reach the existing
  High threshold.
- [ ] Select risk thresholds using validation evidence and operational costs.
- [ ] Document the selected Low, Medium, and High thresholds.
- [ ] Verify that each meaningful risk class can occur on representative data.
- [ ] Add regression tests for threshold boundaries.

### Evaluation Depth

- [ ] Add residual and calibration plots.
- [ ] Report performance by district.
- [ ] Report performance by rainfall range.
- [ ] Report performance by elevation range.
- [ ] Report performance by urban/rural class.
- [ ] Report performance by missing-data level.
- [ ] State where subgroup sample sizes are too small for reliable conclusions.

### Model Card

- [ ] Document training data and cleaning rules.
- [ ] Document feature groups and leakage controls.
- [ ] Document model selection and tuning evidence.
- [ ] Document validation strategy and limitations.
- [ ] Document threshold selection.
- [ ] Document subgroup results.
- [ ] Document intended use, prohibited use, and ethical limitations.

### Stage 1 Acceptance Gate

- [ ] One command reproduces the champion model.
- [ ] The command generates the artifact, metadata, experiment entry, and
  evaluation report.
- [ ] The comparison evidence can be shown during the presentation without
  opening a notebook.

## Stage 2: Production MLOps

Target: maximize MLOps and Production Readiness.

### Continuous Integration

- [ ] Run ML tests in GitHub Actions.
- [ ] Run backend tests in GitHub Actions.
- [ ] Run frontend lint in GitHub Actions.
- [ ] Run TypeScript validation in GitHub Actions.
- [ ] Run the frontend production build in GitHub Actions.
- [ ] Validate Alembic migrations in GitHub Actions.
- [ ] Validate artifact metadata and inference compatibility in GitHub Actions.
- [ ] Show a fully green workflow on the final commit.

### Observability

- [ ] Record total HTTP request count.
- [ ] Record HTTP error count and error rate.
- [ ] Record single-prediction latency.
- [ ] Record batch-prediction latency.
- [ ] Record document indexing failures.
- [ ] Record retrieval latency and result count.
- [ ] Calculate p50 and p95 latency.
- [ ] Include model version in prediction telemetry.
- [ ] Expose the evidence through `GET /monitoring/system`.
- [ ] Add dashboard presentation for the highest-value service metrics.

### Retraining Workflow

- [ ] Add a manually triggered GitHub Actions retraining workflow.
- [ ] Validate the input dataset before training.
- [ ] Train a challenger artifact.
- [ ] Compare the challenger against the champion.
- [ ] Reject the challenger when quality gates fail.
- [ ] Promote only when validation and prediction-distribution gates pass.
- [ ] Publish the promoted artifact and metadata as a GitHub Release asset.
- [ ] Document rollback to the previous model version.

### Scalability Evidence

- [ ] Load-test `GET /health`.
- [ ] Load-test `POST /predict`.
- [ ] Load-test `POST /batch-predict`.
- [ ] Load-test `POST /documents/search`.
- [ ] Record throughput, p50, p95, and failure rate.
- [ ] Explain the current 100-record batch limit.
- [ ] Document the queued-worker architecture required for larger workloads.

### Deployment Hardening

- [ ] Make CORS environment-driven for the production frontend domain.
- [ ] Ensure deployment includes the required seed-provider data.
- [ ] Verify Neon migration from a clean database.
- [ ] Verify persistent uploaded-document storage.
- [ ] Add backend readiness checks.
- [ ] Publish the frontend production URL.
- [ ] Publish the backend API URL.
- [ ] Verify restart recovery for indexed documents and interrupted ingestion.
- [ ] Document secret handling and rotation.
- [ ] Confirm no secrets or uploaded private content are committed.

### Stage 2 Acceptance Gate

- [ ] A clean commit passes all CI jobs.
- [ ] A judge can open the deployed product without local setup.
- [ ] Monitoring proves service health, model activity, failures, and latency.
- [ ] The team can demonstrate champion/challenger promotion and rollback.

## Stage 3: RAG Evaluation

Target: prove that the Copilot is grounded, useful, and safe.

- [ ] Expand the evaluation set to 5-10 documents.
- [ ] Add 20-30 expected retrieval questions.
- [ ] Include exact-keyword questions.
- [ ] Include semantic/paraphrased questions.
- [ ] Include district-filtered questions.
- [ ] Include unsupported questions.
- [ ] Include conflicting-document scenarios.
- [ ] Include prompt-injection text inside a document.
- [ ] Measure Recall@5.
- [ ] Measure mean reciprocal rank.
- [ ] Measure citation correctness.
- [ ] Measure unsupported-answer refusal rate.
- [ ] Measure retrieval latency.
- [ ] Save the final evaluation output as a versioned report.

The Copilot must visibly distinguish:

- model predictions;
- operational priorities;
- monitoring and feedback state;
- retrieved document guidance;
- unavailable live or official information.

### Stage 3 Acceptance Gate

- [ ] The Copilot answers a document-grounded question with a correct citation.
- [ ] The citation opens the correct document and page.
- [ ] Unsupported questions receive a clear evidence-unavailable response.
- [ ] Document prompt injection is treated as untrusted content.

## Stage 4: Mandatory Deliverables

These are submission gates from the official final-round booklet.

### Repository

- [ ] Add team member information to the root README.
- [ ] Add the live frontend link.
- [ ] Add the hosted backend/API link.
- [ ] Confirm setup instructions work from a fresh clone.
- [ ] Confirm deployment instructions match the final Neon/Dokploy/Vercel setup.
- [ ] List dependency and runtime requirements.
- [ ] Make the repository accessible to judges.
- [ ] Remove or update stale planning documents.
- [ ] Replace the default Next.js frontend README.

### External Resources and Licensing

- [ ] Document OpenAI usage and purpose.
- [ ] Document Neon PostgreSQL/pgvector usage and purpose.
- [ ] Document Vercel AI SDK and AI Elements usage.
- [ ] Document MapLibre, mapcn, CARTO, and OpenStreetMap usage.
- [ ] Document major ML libraries and model licenses.
- [ ] Document dataset licensing or competition-provided usage terms.
- [ ] Add required attribution links.

### Technical Documentation

- [ ] Produce the required 5-10 page technical PDF.
- [ ] Include problem understanding and key observations.
- [ ] Include the implemented architecture diagram.
- [ ] Explain the complete data-to-decision workflow.
- [ ] Summarize the Initial Round model.
- [ ] Quantify improvements made in the Final Round.
- [ ] Explain deployment, monitoring, model versioning, and CI/CD.
- [ ] Include limitations and production trade-offs.
- [ ] Visually inspect every rendered PDF page.

### Presentation and Demo

- [ ] Produce the actual presentation slide deck.
- [ ] Keep the presentation within 8-10 minutes.
- [ ] Include team introduction.
- [ ] Include problem understanding.
- [ ] Include Initial Round approach and measured improvements.
- [ ] Include architecture and MLOps workflow.
- [ ] Include challenges and solutions.
- [ ] Include future improvements.
- [ ] Record a backup demo video.
- [ ] Verify the live demo from the presentation machine and network.

### Stage 4 Acceptance Gate

- [ ] Every mandatory deliverable exists and opens correctly.
- [ ] No document describes an implemented feature as merely planned.
- [ ] All public claims can be demonstrated or supported with evidence.

## Stage 5: Winning Demonstration

Target duration: 8-10 minutes total.

### Timing

- [ ] `0:00-0:45` - Explain the operational flood-risk problem.
- [ ] `0:45-1:30` - Show the Initial Round model and measured improvements.
- [ ] `1:30-2:15` - Explain the production architecture.
- [ ] `2:15-5:45` - Demonstrate the end-to-end operational workflow.
- [ ] `5:45-6:45` - Show feedback, drift, monitoring, and retraining evidence.
- [ ] `6:45-7:45` - Show document-grounded Copilot evidence and citations.
- [ ] `7:45-8:45` - Show CI, deployment, and scalability evidence.
- [ ] `8:45-9:15` - Close with limitations, business value, and next steps.

### Demo Story

```text
Select district
  -> identify vulnerable place
  -> run model prediction
  -> inspect drivers and uncertainty
  -> prioritize operational response
  -> record feedback or observed outcome
  -> inspect drift and model health
  -> ask Copilot using cited SOP evidence
```

### Demo Reliability

- [ ] Preload representative, non-empty data.
- [ ] Use a record that produces a defensible model result.
- [ ] Use a document with a known citation result.
- [ ] Keep backup screenshots available.
- [ ] Keep the backup video available offline.
- [ ] Prepare a no-OpenAI fallback explanation.
- [ ] Prepare a no-database fallback explanation.
- [ ] Never expose API keys, database credentials, or private documents.

## Stage 6: Viva Preparation

Every team member must be able to explain:

- [ ] why stratified 10-fold validation was selected;
- [ ] how target leakage is prevented;
- [ ] why the ensemble improves on individual models;
- [ ] how hyperparameters were selected;
- [ ] how risk thresholds were calibrated;
- [ ] why baseline risk is separate from model risk;
- [ ] why emergency priority is not identical to prediction score;
- [ ] how drift and feedback disagreement are calculated;
- [ ] how a challenger is evaluated and promoted;
- [ ] how rollback works;
- [ ] what happens when OpenAI, Neon, or the model service is unavailable;
- [ ] how the system scales beyond the prototype batch limit;
- [ ] why presentation coordinates differ from raw coordinates;
- [ ] what verified data and governance are required before official use;
- [ ] the reason for every external service and major technology choice;
- [ ] the most important debugging problems encountered and how they were fixed.

### Stage 6 Acceptance Gate

- [ ] Run at least two timed mock presentations.
- [ ] Run one hostile-question viva rehearsal.
- [ ] Ensure every team member answers architecture, model, MLOps, and failure
  questions without relying on another member.

## Execution Order

Work in this order because it maximizes score and reduces submission risk:

1. Model evaluation, comparison, and threshold calibration.
2. Broken tuning and deployment fixes.
3. Complete CI and retraining workflow.
4. Observability and load-testing evidence.
5. RAG evaluation.
6. Final technical PDF and presentation slides.
7. Backup video.
8. Repeated demo and viva rehearsal.

## Scope Control

Do not add more product features before completing this roadmap. Every remaining
change should produce judge-visible evidence for accuracy, automation,
reliability, deployment, business value, or decision justification.
