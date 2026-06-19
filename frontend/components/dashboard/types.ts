import type { LatestModelScore, PredictionResult } from "@/lib/api"

export type ApiState = "checking" | "online" | "offline"

export type ActiveView =
  | "overview"
  | "explorer"
  | "districts"
  | "priority"
  | "prediction"
  | "monitoring"

export type LocationFeatureProperties = {
  record_id: string
  district: string
  place_name: string
}

export type ServedScore = PredictionResult | LatestModelScore

export const ALL_DISTRICTS = "__all__"
