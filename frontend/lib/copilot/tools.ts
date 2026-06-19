import { tool } from "ai"
import { z } from "zod"

import type { DocumentSearchResponse } from "@/lib/documents"

const API_BASE_URL =
  process.env.FLOODLENS_API_BASE_URL?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000"

const MAX_LIMIT = 25

type QueryParams = Record<string, string | number | undefined | null>

async function floodLensRequest<T>(
  path: string,
  params?: QueryParams,
  init?: RequestInit
): Promise<T> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value))
    }
  }

  const suffix = query.toString() ? `?${query.toString()}` : ""
  const response = await fetch(`${API_BASE_URL}${path}${suffix}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(
      detail || `FloodLens backend request failed with ${response.status}`
    )
  }

  return response.json() as Promise<T>
}

function boundedLimit(limit: number | undefined, fallback: number) {
  return Math.max(1, Math.min(limit ?? fallback, MAX_LIMIT))
}

export const copilotTools = {
  getModelInfo: tool({
    description:
      "Get active FloodLens model version, feature count, training time, and validation metrics.",
    inputSchema: z.object({}),
    execute: async () => ({
      source: "model-info",
      data: await floodLensRequest("/model-info"),
    }),
  }),

  getDistrictSummary: tool({
    description:
      "Get district-level flood-risk summary sorted by average baseline risk.",
    inputSchema: z.object({
      limit: z.number().int().positive().max(MAX_LIMIT).optional(),
    }),
    execute: async ({ limit }) => {
      const data = await floodLensRequest<unknown[]>("/district-summary")
      return {
        source: "district-summary",
        data: data.slice(0, boundedLimit(limit, 10)),
      }
    },
  }),

  getHighRiskLocations: tool({
    description:
      "Get high-risk monitored places, optionally filtered by district.",
    inputSchema: z.object({
      district: z.string().optional(),
      limit: z.number().int().positive().max(MAX_LIMIT).optional(),
    }),
    execute: async ({ district, limit }) => ({
      source: "high-risk-locations",
      data: await floodLensRequest("/high-risk-locations", {
        district,
        limit: boundedLimit(limit, 10),
      }),
    }),
  }),

  getEmergencyPriority: tool({
    description:
      "Get response-priority monitored places, optionally filtered by district.",
    inputSchema: z.object({
      district: z.string().optional(),
      limit: z.number().int().positive().max(MAX_LIMIT).optional(),
    }),
    execute: async ({ district, limit }) => ({
      source: "emergency-priority",
      data: await floodLensRequest("/emergency-priority", {
        district,
        limit: boundedLimit(limit, 10),
      }),
    }),
  }),

  getLocationRecord: tool({
    description:
      "Get a full monitored-place record by record ID, including raw model fields.",
    inputSchema: z.object({
      recordId: z.string().describe("FloodLens record ID such as F104559."),
    }),
    execute: async ({ recordId }) => ({
      source: "location-record",
      data: await floodLensRequest(
        `/locations/${encodeURIComponent(recordId)}/record`
      ),
    }),
  }),

  getModelScores: tool({
    description:
      "Get latest persisted model scores, optionally filtered by district.",
    inputSchema: z.object({
      district: z.string().optional(),
      limit: z.number().int().positive().max(MAX_LIMIT).optional(),
    }),
    execute: async ({ district, limit }) => ({
      source: "model-scores",
      data: await floodLensRequest("/model-scores", {
        district,
        limit: boundedLimit(limit, 10),
      }),
    }),
  }),

  getMonitoringSummary: tool({
    description:
      "Get prediction serving volume, risk distribution, batch runs, and model-version activity.",
    inputSchema: z.object({}),
    execute: async () => ({
      source: "monitoring-summary",
      data: await floodLensRequest("/monitoring/summary"),
    }),
  }),

  getFeedbackSummary: tool({
    description:
      "Get feedback volume, usefulness counts, observed outcomes, disagreement rate, and retraining candidate state.",
    inputSchema: z.object({}),
    execute: async () => ({
      source: "feedback-summary",
      data: await floodLensRequest("/feedback/summary"),
    }),
  }),

  getDriftSummary: tool({
    description:
      "Get recent scored-record drift status, risk shift, district shift, feature warnings, and recommendation.",
    inputSchema: z.object({}),
    execute: async () => ({
      source: "monitoring-drift",
      data: await floodLensRequest("/monitoring/drift"),
    }),
  }),

  searchDocuments: tool({
    description:
      "Search uploaded SOPs, policies, and field reports for cited operational evidence. Use this before answering document-guidance or action-procedure questions.",
    inputSchema: z.object({
      query: z.string().min(1).max(2000),
      district: z.string().optional(),
      documentTypes: z
        .array(z.enum(["sop", "policy", "field_report", "other"]))
        .optional(),
      documentIds: z.array(z.string()).max(10).optional(),
      limit: z.number().int().positive().max(6).optional(),
    }),
    execute: async ({ query, district, documentTypes, documentIds, limit }) => ({
      source: "document-retrieval",
      data: await floodLensRequest<DocumentSearchResponse>(
        "/documents/search",
        undefined,
        {
          method: "POST",
          body: JSON.stringify({
            query,
            district,
            document_types: documentTypes,
            document_ids: documentIds,
            limit: Math.min(limit ?? 6, 6),
          }),
        }
      ),
    }),
  }),
}
