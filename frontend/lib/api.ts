import type { Feature, Polygon } from "geojson"

export type ModelInfo = {
  model_version: string
  trained_at: string
  feature_count: number
  model_order: string[]
  metrics: {
    oof_mae: number
    oof_rmse: number
    test_std: number
    n_features: number
    n_train: number
    training_time_s: number
    [key: string]: unknown
  }
}

export type MonitoringSummary = {
  total_predictions: number
  single_prediction_count: number
  batch_prediction_count: number
  scenario_prediction_count: number
  batch_run_count: number
  latest_batch_id: string | null
  low_risk_count: number
  medium_risk_count: number
  high_risk_count: number
  average_risk_score: number | null
  latest_prediction_at: string | null
  model_versions: Record<string, number>
  top_districts_by_predictions: Array<{
    district: string
    count: number
  }>
}

export type FeedbackRating = "useful" | "not_useful"
export type ObservedOutcome = "flooded" | "not_flooded" | "unknown"

export type FeedbackEvent = {
  timestamp: string
  record_id: string
  district: string | null
  place_name: string | null
  model_version: string
  rating: FeedbackRating
  observed_outcome: ObservedOutcome
  notes: string | null
  source: "dashboard" | "api"
  flood_risk_score: number | null
  risk_level: "Low" | "Medium" | "High" | null
  disagreement: boolean
}

export type FeedbackSummary = {
  total_feedback: number
  useful_count: number
  not_useful_count: number
  observed_flood_count: number
  observed_no_flood_count: number
  disagreement_count: number
  disagreement_rate: number
  latest_feedback_at: string | null
  retraining_candidate: boolean
  top_feedback_districts: Array<{
    district: string
    count: number
  }>
}

export type DriftSummary = {
  status: "insufficient_data" | "ok" | "watch" | "retraining_candidate"
  sample_size: number
  reference_size: number
  risk_score_shift: {
    recent_average: number | null
    reference_average: number | null
    absolute_difference: number | null
  }
  district_shift: {
    largest_shift_district: string | null
    absolute_difference: number | null
  }
  feature_warnings: Array<{
    feature: string
    recent_mean: number
    reference_mean: number
    relative_change: number
    status: "watch" | "retraining_candidate"
  }>
  recommendation: string
}

export type SystemMonitoringSummary = {
  total_requests: number
  error_count: number
  error_rate: number
  p50_latency_ms: number | null
  p95_latency_ms: number | null
  routes: Array<{
    route: string
    count: number
    error_count: number
    p50_latency_ms: number | null
    p95_latency_ms: number | null
  }>
  latest_error_at: string | null
  document_indexing_failures: number
  retrieval_events: number
}

export type PredictionResult = {
  record_id: string | null
  flood_risk_score: number
  risk_level: "Low" | "Medium" | "High"
  model_version: string
}

export type LatestModelScore = PredictionResult & {
  record_id: string
  district: string
  place_name: string
  baseline_risk_score: number
  baseline_risk_level: "Low" | "Medium" | "High"
  operational_priority: "Routine" | "Watch" | "Elevated" | "Critical"
  scored_at: string
  source: "batch" | "api"
  batch_id?: string
}

export type BatchPrediction = PredictionResult & {
  record_id: string
  district: string
  place_name: string
  baseline_risk_score: number
  baseline_risk_level: "Low" | "Medium" | "High"
  operational_priority: "Routine" | "Watch" | "Elevated" | "Critical"
}

export type LocationRow = {
  record_id: string
  district: string
  place_name: string
  latitude: number
  longitude: number
  raw_latitude: number
  raw_longitude: number
  map_latitude: number
  map_longitude: number
  coordinate_source: string
  asset_type: string
  data_provider: string
  baseline_risk_score: number
  baseline_risk_level: "Low" | "Medium" | "High"
  operational_priority: "Routine" | "Watch" | "Elevated" | "Critical"
  risk_drivers: string[]
  recommended_action: string
  rainfall_7d_mm?: number | null
  monthly_rainfall_mm?: number | null
  elevation_m?: number | null
  distance_to_river_m?: number | null
  nearest_evac_km?: number | null
  population_density_per_km2?: number | null
  historical_flood_count?: number | null
  infrastructure_score?: number | null
  urban_rural?: string | null
  landcover?: string | null
  soil_type?: string | null
}

export type DistrictSummary = {
  district: string
  monitored_places: number
  average_baseline_risk_score: number
  high_risk_count: number
  critical_priority_count: number
  elevated_priority_count: number
  top_risk_drivers: Array<{
    driver: string
    count: number
  }>
}

export type HighRiskLocation = {
  record_id: string
  district: string
  place_name: string
  asset_type: string
  baseline_risk_score: number
  baseline_risk_level: "Low" | "Medium" | "High"
  operational_priority: "Routine" | "Watch" | "Elevated" | "Critical"
  risk_drivers: string[]
  recommended_action: string
}

export type EmergencyPriorityLocation = {
  rank: number
  record_id: string
  district: string
  place_name: string
  asset_type: string
  emergency_priority_score: number
  baseline_risk_score: number
  baseline_risk_level: "Low" | "Medium" | "High"
  operational_priority: "Routine" | "Watch" | "Elevated" | "Critical"
  priority_reasons: string[]
  recommended_action: string
}

export type BatchPredictResponse = {
  batch_id: string
  source: "batch"
  model_version: string
  district: string | null
  requested: number
  scored: number
  predictions: BatchPrediction[]
}

export type ScenarioContext = {
  inside_sri_lanka: boolean
  latitude: number
  longitude: number
  district: string
  place_name: string
  context_source: string
  warnings: string[]
  context: ScenarioOverrides
  boundary: Feature<Polygon>
}

export type ScenarioOverrides = {
  rainfall_7d_mm?: number
  monthly_rainfall_mm?: number
  elevation_m?: number
  distance_to_river_m?: number
  nearest_evac_km?: number
  population_density_per_km2?: number
  historical_flood_count?: number
  infrastructure_score?: number
}

export type ScenarioResult = {
  scenario_id: string
  record_id: string
  district: string
  place_name: string
  latitude: number
  longitude: number
  baseline_risk_score: number
  baseline_risk_level: "Low" | "Medium" | "High"
  simulated_baseline_risk_score: number
  model_flood_risk_score: number
  scenario_risk_score: number
  scenario_risk_level: "Low" | "Medium" | "High"
  score_delta: number
  risk_level_delta: string
  changed_fields: string[]
  risk_drivers: string[]
  operational_priority: "Routine" | "Watch" | "Elevated" | "Critical"
  recommended_action: string
  model_version: string
  context_source: string
  scenario_record: Record<string, unknown>
}

export type ApiHealth = {
  status: string
  service: string
  model_loaded: boolean
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `Request failed with ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function getHealth() {
  return request<ApiHealth>("/health")
}

export function getModelInfo() {
  return request<ModelInfo>("/model-info")
}

export function getMonitoringSummary() {
  return request<MonitoringSummary>("/monitoring/summary")
}

export function getDriftSummary() {
  return request<DriftSummary>("/monitoring/drift")
}

export function getSystemMonitoringSummary() {
  return request<SystemMonitoringSummary>("/monitoring/system")
}

export function getFeedbackSummary() {
  return request<FeedbackSummary>("/feedback/summary")
}

export function submitFeedback(payload: {
  record_id: string
  model_version: string
  rating: FeedbackRating
  observed_outcome?: ObservedOutcome
  notes?: string
  source?: "dashboard" | "api"
}) {
  return request<FeedbackEvent>("/feedback", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      observed_outcome: payload.observed_outcome ?? "unknown",
      source: payload.source ?? "dashboard",
    }),
  })
}

export function predictFloodRisk(record: Record<string, unknown>) {
  return request<PredictionResult>("/predict", {
    method: "POST",
    body: JSON.stringify({ record }),
  })
}

export function getScenarioContext(payload: {
  latitude: number
  longitude: number
  district?: string
  place_name?: string
}) {
  return request<ScenarioContext>("/scenario/context", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function simulateScenario(payload: {
  record_id?: string
  location?: Record<string, unknown>
  overrides?: ScenarioOverrides
}) {
  return request<ScenarioResult>("/scenario/simulate", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function downloadActionReport(payload: {
  scenario: ScenarioResult
  citations?: Array<Record<string, unknown>>
}) {
  const response = await fetch(`${API_BASE_URL}/reports/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `Request failed with ${response.status}`)
  }

  return response.blob()
}

export function batchPredict(params?: {
  district?: string
  limit?: number
  record_ids?: string[]
}) {
  return request<BatchPredictResponse>("/batch-predict", {
    method: "POST",
    body: JSON.stringify({
      district: params?.district,
      limit: params?.limit ?? 100,
      record_ids: params?.record_ids,
    }),
  })
}

export function getModelScores(params?: {
  district?: string
  limit?: number
}) {
  const query = new URLSearchParams()
  if (params?.district) query.set("district", params.district)
  if (params?.limit) query.set("limit", String(params.limit))
  const suffix = query.toString() ? `?${query.toString()}` : ""
  return request<LatestModelScore[]>(`/model-scores${suffix}`)
}

export function getDistricts() {
  return request<string[]>("/districts")
}

export function getLocations(params?: {
  district?: string
  search?: string
  limit?: number
}) {
  const query = new URLSearchParams()
  if (params?.district) query.set("district", params.district)
  if (params?.search) query.set("search", params.search)
  if (params?.limit) query.set("limit", String(params.limit))
  const suffix = query.toString() ? `?${query.toString()}` : ""
  return request<LocationRow[]>(`/locations${suffix}`)
}

export function getLocationRecord(recordId: string) {
  return request<Record<string, unknown>>(
    `/locations/${encodeURIComponent(recordId)}/record`
  )
}

export function getDistrictSummary() {
  return request<DistrictSummary[]>("/district-summary")
}

export function getHighRiskLocations(params?: {
  district?: string
  limit?: number
}) {
  const query = new URLSearchParams()
  if (params?.district) query.set("district", params.district)
  if (params?.limit) query.set("limit", String(params.limit))
  const suffix = query.toString() ? `?${query.toString()}` : ""
  return request<HighRiskLocation[]>(`/high-risk-locations${suffix}`)
}

export function getEmergencyPriority(params?: {
  district?: string
  limit?: number
}) {
  const query = new URLSearchParams()
  if (params?.district) query.set("district", params.district)
  if (params?.limit) query.set("limit", String(params.limit))
  const suffix = query.toString() ? `?${query.toString()}` : ""
  return request<EmergencyPriorityLocation[]>(`/emergency-priority${suffix}`)
}
