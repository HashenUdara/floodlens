import type { LatestModelScore, PredictionResult } from "@/lib/api"

export type ApiState = "checking" | "online" | "offline"

export type AppMode = "command" | "ops"

export type ActiveView =
  | "briefing"
  | "risk-map"
  | "priority-list"
  | "scenario"
  | "reports"
  | "response-documents"
  | "copilot"
  | "model-overview"
  | "serving"
  | "monitoring"
  | "feedback-drift"
  | "knowledge-ops"
  | "developer-tools"

export type LocationFeatureProperties = {
  record_id: string
  district: string
  place_name: string
}

export type ServedScore = PredictionResult | LatestModelScore

export const ALL_DISTRICTS = "__all__"
