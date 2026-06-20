"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { AlertTriangle, RadioTower, Waves } from "lucide-react"

import {
  batchPredict,
  DriftSummary,
  DistrictSummary,
  EmergencyPriorityLocation,
  FeedbackRating,
  FeedbackSummary,
  getDistricts,
  getDistrictSummary,
  getDriftSummary,
  getEmergencyPriority,
  getFeedbackSummary,
  getHealth,
  getHighRiskLocations,
  getLocationRecord,
  getLocations,
  getModelInfo,
  getModelScores,
  getMonitoringSummary,
  getSystemMonitoringSummary,
  HighRiskLocation,
  LatestModelScore,
  LocationRow,
  ModelInfo,
  MonitoringSummary,
  ObservedOutcome,
  predictFloodRisk,
  PredictionResult,
  submitFeedback,
  SystemMonitoringSummary,
} from "@/lib/api"
import { sampleRecord } from "@/lib/sample-record"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  ALL_DISTRICTS,
  ActiveView,
  ApiState,
  ServedScore,
} from "@/components/dashboard/types"
import {
  DashboardSidebar,
  MobileHeader,
} from "@/components/dashboard/shell"
import { CopilotPanel } from "@/components/dashboard/copilot-panel"
import { KnowledgeLibrary } from "@/components/dashboard/knowledge-library"
import { DistrictCommandPanel, PriorityQueuePanel } from "@/components/dashboard/decision-panels"
import { RiskExplorer } from "@/components/dashboard/risk-explorer"
import { ScenarioLab } from "@/components/dashboard/scenario-lab"
import {
  MetricGrid,
  MonitoringPanel,
  OverviewPanel,
  PredictionPanel,
} from "@/components/dashboard/status-panels"
import { StatusPill } from "@/components/dashboard/shared"
import type { KnowledgeDocument } from "@/lib/documents"

const initialPayload = JSON.stringify(sampleRecord, null, 2)

export default function Home() {
  const [activeView, setActiveView] = useState<ActiveView>("overview")
  const [apiState, setApiState] = useState<ApiState>("checking")
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null)
  const [monitoring, setMonitoring] = useState<MonitoringSummary | null>(null)
  const [feedbackSummary, setFeedbackSummary] =
    useState<FeedbackSummary | null>(null)
  const [driftSummary, setDriftSummary] = useState<DriftSummary | null>(null)
  const [systemMonitoring, setSystemMonitoring] =
    useState<SystemMonitoringSummary | null>(null)
  const [districts, setDistricts] = useState<string[]>([])
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [districtSummary, setDistrictSummary] = useState<DistrictSummary[]>([])
  const [highRiskLocations, setHighRiskLocations] = useState<HighRiskLocation[]>([])
  const [emergencyPriority, setEmergencyPriority] = useState<
    EmergencyPriorityLocation[]
  >([])
  const [latestModelScores, setLatestModelScores] = useState<
    Record<string, LatestModelScore>
  >({})
  const [district, setDistrict] = useState(ALL_DISTRICTS)
  const [search, setSearch] = useState("")
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [payload, setPayload] = useState(initialPayload)
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [locationPredictions, setLocationPredictions] = useState<
    Record<string, ServedScore>
  >({})
  const [loadingDashboard, setLoadingDashboard] = useState(true)
  const [loadingLocations, setLoadingLocations] = useState(true)
  const [loadingDecision, setLoadingDecision] = useState(true)
  const [predicting, setPredicting] = useState(false)
  const [predictingRecordId, setPredictingRecordId] = useState<string | null>(
    null
  )
  const [batchScoring, setBatchScoring] = useState(false)
  const [batchStatus, setBatchStatus] = useState<string | null>(null)
  const [feedbackSubmittingRecordId, setFeedbackSubmittingRecordId] =
    useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copilotDraft, setCopilotDraft] = useState<string | null>(null)

  async function refreshOperations() {
    const [summary, feedback, drift, system] = await Promise.all([
      getMonitoringSummary(),
      getFeedbackSummary(),
      getDriftSummary(),
      getSystemMonitoringSummary(),
    ])
    setMonitoring(summary)
    setFeedbackSummary(feedback)
    setDriftSummary(drift)
    setSystemMonitoring(system)
  }

  async function refreshModelScores(scopedDistrict?: string) {
    const scores = await getModelScores({ district: scopedDistrict, limit: 100 })
    setLatestModelScores(
      Object.fromEntries(scores.map((score) => [score.record_id, score]))
    )
  }

  useEffect(() => {
    let ignore = false

    async function loadDashboard() {
      try {
        const [health, model, summary, feedback, drift, system, districtList] =
          await Promise.all([
            getHealth(),
            getModelInfo(),
            getMonitoringSummary(),
            getFeedbackSummary(),
            getDriftSummary(),
            getSystemMonitoringSummary(),
            getDistricts(),
          ])
        if (ignore) return
        setApiState(health.model_loaded ? "online" : "offline")
        setModelInfo(model)
        setMonitoring(summary)
        setFeedbackSummary(feedback)
        setDriftSummary(drift)
        setSystemMonitoring(system)
        setDistricts(districtList)
      } catch (err: unknown) {
        if (ignore) return
        setApiState("offline")
        setError(err instanceof Error ? err.message : "Backend is unavailable")
      } finally {
        if (!ignore) setLoadingDashboard(false)
      }
    }

    void loadDashboard()

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false

    async function loadLocations() {
      setLoadingLocations(true)
      try {
        const rows = await getLocations({
          district: district === ALL_DISTRICTS ? undefined : district,
          search,
          limit: 250,
        })
        if (ignore) return
        setLocations(rows)
        setSelectedRecordId((current) =>
          current && rows.some((row) => row.record_id === current)
            ? current
            : rows[0]?.record_id ?? null
        )
      } catch (err: unknown) {
        if (ignore) return
        setError(err instanceof Error ? err.message : "Location request failed")
      } finally {
        if (!ignore) setLoadingLocations(false)
      }
    }

    const timer = window.setTimeout(() => {
      void loadLocations()
    }, 180)

    return () => {
      ignore = true
      window.clearTimeout(timer)
    }
  }, [district, search])

  useEffect(() => {
    let ignore = false

    async function loadDecisionData() {
      setLoadingDecision(true)
      try {
        const scopedDistrict = district === ALL_DISTRICTS ? undefined : district
        const [summary, highRisk, priority, scores] = await Promise.all([
          getDistrictSummary(),
          getHighRiskLocations({ district: scopedDistrict, limit: 25 }),
          getEmergencyPriority({ district: scopedDistrict, limit: 25 }),
          getModelScores({ district: scopedDistrict, limit: 100 }),
        ])
        if (ignore) return
        setDistrictSummary(summary)
        setHighRiskLocations(highRisk)
        setEmergencyPriority(priority)
        setLatestModelScores(
          Object.fromEntries(scores.map((score) => [score.record_id, score]))
        )
      } catch (err: unknown) {
        if (ignore) return
        setError(err instanceof Error ? err.message : "Decision request failed")
      } finally {
        if (!ignore) setLoadingDecision(false)
      }
    }

    void loadDecisionData()

    return () => {
      ignore = true
    }
  }, [district])

  const selectedLocation = useMemo(
    () => locations.find((row) => row.record_id === selectedRecordId) ?? null,
    [locations, selectedRecordId]
  )

  const servedScores = useMemo<Record<string, ServedScore>>(
    () => ({
      ...latestModelScores,
      ...locationPredictions,
    }),
    [latestModelScores, locationPredictions]
  )

  const riskTotal = useMemo(
    () =>
      (monitoring?.low_risk_count ?? 0) +
      (monitoring?.medium_risk_count ?? 0) +
      (monitoring?.high_risk_count ?? 0),
    [monitoring]
  )

  async function handleJsonPredict(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPredicting(true)
    setError(null)

    try {
      const record = JSON.parse(payload) as Record<string, unknown>
      const result = await predictFloodRisk(record)
      setPrediction(result)
      if (result.record_id) {
        setLocationPredictions((current) => ({
          ...current,
          [result.record_id as string]: result,
        }))
      }
      await refreshOperations()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Prediction request failed")
    } finally {
      setPredicting(false)
    }
  }

  async function handlePredictLocation(recordId: string) {
    setPredictingRecordId(recordId)
    setError(null)

    try {
      const record = await getLocationRecord(recordId)
      const result = await predictFloodRisk(record)
      setPrediction(result)
      setLocationPredictions((current) => ({ ...current, [recordId]: result }))
      setSelectedRecordId(recordId)
      await refreshOperations()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Prediction request failed")
    } finally {
      setPredictingRecordId(null)
    }
  }

  async function handleBatchScore(recordIds?: string[]) {
    const scopedDistrict = district === ALL_DISTRICTS ? undefined : district
    if (recordIds && recordIds.length === 0) {
      setBatchStatus("0 visible scored")
      return
    }
    setBatchScoring(true)
    setError(null)

    try {
      const result = await batchPredict({
        district: scopedDistrict,
        limit: recordIds?.length ?? 100,
        record_ids: recordIds,
      })
      setBatchStatus(`${result.scored.toLocaleString()} visible scored`)
      await Promise.all([refreshOperations(), refreshModelScores(scopedDistrict)])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Batch scoring failed")
    } finally {
      setBatchScoring(false)
    }
  }

  function handleOpenLocation(recordId: string, nextDistrict?: string) {
    if (nextDistrict) setDistrict(nextDistrict)
    setSearch(recordId)
    setSelectedRecordId(recordId)
    setActiveView("explorer")
  }

  async function handleSubmitFeedback(payload: {
    recordId: string
    modelVersion: string
    rating: FeedbackRating
    observedOutcome: ObservedOutcome
  }) {
    setFeedbackSubmittingRecordId(payload.recordId)
    setError(null)

    try {
      await submitFeedback({
        record_id: payload.recordId,
        model_version: payload.modelVersion,
        rating: payload.rating,
        observed_outcome: payload.observedOutcome,
      })
      await refreshOperations()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Feedback request failed")
      throw err
    } finally {
      setFeedbackSubmittingRecordId(null)
    }
  }

  function handleAskDocument(document: KnowledgeDocument) {
    setCopilotDraft(
      `Use the Knowledge Library document "${document.title}" (document ID ${document.id}) to summarize the operational guidance, then explain how it should be applied with FloodLens risk and priority evidence. Cite the document pages used.`
    )
    setActiveView("copilot")
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <DashboardSidebar
          activeView={activeView}
          apiState={apiState}
          modelVersion={modelInfo?.model_version}
          totalPredictions={monitoring?.total_predictions ?? 0}
          onChange={setActiveView}
        />

        <section className="flex min-w-0 flex-1 flex-col">
          <MobileHeader
            activeView={activeView}
            apiState={apiState}
            modelVersion={modelInfo?.model_version}
            totalPredictions={monitoring?.total_predictions ?? 0}
            onChange={setActiveView}
          />

          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
            <header className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-cyan-400/30 text-cyan-300"
                  >
                    <Waves className="size-3" />
                    FloodLens
                  </Badge>
                  <Badge
                    variant={apiState === "online" ? "secondary" : "destructive"}
                    className="gap-1.5"
                  >
                    <RadioTower className="size-3" />
                    API {apiState}
                  </Badge>
                  {modelInfo ? (
                    <Badge variant="outline" className="font-mono">
                      {modelInfo.model_version}
                    </Badge>
                  ) : null}
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                  FloodLens Operations Command
                </h1>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  Business-ready flood intelligence for monitored communities,
                  assets, and response planning across Sri Lanka.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm sm:flex">
                <StatusPill label="Monitored places" value={locations.length.toString()} />
                <StatusPill
                  label="Logged events"
                  value={`${monitoring?.total_predictions ?? 0}`}
                />
              </div>
            </header>

            {error ? (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertTitle>Request failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-col gap-4">
              {activeView === "overview" ? (
                <>
                  <MetricGrid
                    modelInfo={modelInfo}
                    monitoring={monitoring}
                    loading={loadingDashboard}
                  />
                  <OverviewPanel
                    apiState={apiState}
                    modelInfo={modelInfo}
                    monitoring={monitoring}
                    riskTotal={riskTotal}
                    loading={loadingDashboard}
                  />
                </>
              ) : null}

              {activeView === "explorer" ? (
                <RiskExplorer
                  districts={districts}
                  district={district}
                  search={search}
                  locations={locations}
                  selectedLocation={selectedLocation}
                  predictions={servedScores}
                  loading={loadingLocations}
                  predictingRecordId={predictingRecordId}
                  feedbackSubmittingRecordId={feedbackSubmittingRecordId}
                  onDistrictChange={setDistrict}
                  onSearchChange={setSearch}
                  onSelectLocation={setSelectedRecordId}
                  onPredictLocation={handlePredictLocation}
                  onSubmitFeedback={handleSubmitFeedback}
                />
              ) : null}

              {activeView === "scenario" ? (
                <ScenarioLab
                  locations={locations}
                  selectedLocation={selectedLocation}
                  onSelectLocation={setSelectedRecordId}
                  onOperationsRefresh={refreshOperations}
                />
              ) : null}

              {activeView === "districts" ? (
                <DistrictCommandPanel
                  district={district}
                  districts={districts}
                  summaries={districtSummary}
                  highRiskLocations={highRiskLocations}
                  latestScores={latestModelScores}
                  loading={loadingDecision}
                  batchScoring={batchScoring}
                  batchStatus={batchStatus}
                  onDistrictChange={setDistrict}
                  onBatchScore={handleBatchScore}
                  onOpenLocation={handleOpenLocation}
                />
              ) : null}

              {activeView === "priority" ? (
                <PriorityQueuePanel
                  district={district}
                  districts={districts}
                  priorityLocations={emergencyPriority}
                  latestScores={latestModelScores}
                  loading={loadingDecision}
                  batchScoring={batchScoring}
                  batchStatus={batchStatus}
                  onDistrictChange={setDistrict}
                  onBatchScore={handleBatchScore}
                  onOpenLocation={handleOpenLocation}
                />
              ) : null}

              {activeView === "prediction" ? (
                <PredictionPanel
                  payload={payload}
                  prediction={prediction}
                  predicting={predicting}
                  onPayloadChange={setPayload}
                  onResetPayload={() => setPayload(initialPayload)}
                  onPredict={handleJsonPredict}
                  feedbackSubmittingRecordId={feedbackSubmittingRecordId}
                  onSubmitFeedback={handleSubmitFeedback}
                />
              ) : null}

              {activeView === "monitoring" ? (
                <MonitoringPanel
                  monitoring={monitoring}
                  feedbackSummary={feedbackSummary}
                  driftSummary={driftSummary}
                  systemMonitoring={systemMonitoring}
                />
              ) : null}

              {activeView === "knowledge" ? (
                <KnowledgeLibrary
                  districts={districts}
                  onAskCopilot={handleAskDocument}
                />
              ) : null}

              {activeView === "copilot" ? (
                <CopilotPanel
                  initialPrompt={copilotDraft}
                  onInitialPromptConsumed={() => setCopilotDraft(null)}
                  onOpenKnowledge={() => setActiveView("knowledge")}
                />
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
