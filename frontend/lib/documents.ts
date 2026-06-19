export type DocumentStatus = "queued" | "processing" | "ready" | "failed"
export type DocumentType = "sop" | "policy" | "field_report" | "other"

export type KnowledgeDocument = {
  id: string
  title: string
  original_filename: string
  mime_type: string
  document_type: DocumentType
  district: string | null
  size_bytes: number
  status: DocumentStatus
  embedding_model: string
  chunk_count: number
  index_version: number
  failure_message: string | null
  created_at: string
  updated_at: string
  indexed_at: string | null
}

export type DocumentSummary = {
  total: number
  ready: number
  indexing: number
  failed: number
  chunk_count: number
  latest_indexed_at: string | null
}

export type DocumentSearchResult = {
  chunk_id: string
  document_id: string
  title: string
  document_type: DocumentType
  district: string | null
  page: number | null
  excerpt: string
  semantic_score: number | null
  fused_relevance: number
  citation_url: string
}

export type DocumentSearchResponse = {
  source: "document-retrieval"
  embedding_model: string
  latency_ms: number
  results: DocumentSearchResult[]
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000"

async function documentRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: { message?: string } | string }
      | null
    const detail = payload?.detail
    const message =
      typeof detail === "string" ? detail : detail?.message ?? `Request failed (${response.status})`
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function listDocuments(params?: {
  status?: DocumentStatus
  district?: string
  documentType?: DocumentType
  search?: string
  limit?: number
}) {
  const query = new URLSearchParams()
  if (params?.status) query.set("status", params.status)
  if (params?.district) query.set("district", params.district)
  if (params?.documentType) query.set("document_type", params.documentType)
  if (params?.search) query.set("search", params.search)
  query.set("limit", String(params?.limit ?? 100))
  return documentRequest<KnowledgeDocument[]>(`/documents?${query.toString()}`)
}

export function getDocumentSummary() {
  return documentRequest<DocumentSummary>("/documents/summary")
}

export function deleteDocument(documentId: string) {
  return documentRequest<void>(`/documents/${encodeURIComponent(documentId)}`, {
    method: "DELETE",
  })
}

export function reindexDocument(documentId: string) {
  return documentRequest<KnowledgeDocument>(
    `/documents/${encodeURIComponent(documentId)}/reindex`,
    { method: "POST", body: "{}" }
  )
}

export function searchDocuments(payload: {
  query: string
  district?: string
  document_types?: DocumentType[]
  document_ids?: string[]
  limit?: number
}) {
  return documentRequest<DocumentSearchResponse>("/documents/search", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function documentFileUrl(documentId: string, page?: number | null) {
  const fragment = page ? `#page=${page}` : ""
  return `${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/file${fragment}`
}

export function uploadDocument(
  payload: {
    file: File
    title?: string
    documentType: DocumentType
    district?: string
  },
  onProgress: (progress: number) => void
) {
  const xhr = new XMLHttpRequest()
  const promise = new Promise<KnowledgeDocument>((resolve, reject) => {
    xhr.open("POST", `${API_BASE_URL}/documents`)
    xhr.responseType = "json"
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    })
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as KnowledgeDocument)
        return
      }
      const detail = xhr.response?.detail
      reject(
        new Error(
          typeof detail === "string"
            ? detail
            : detail?.message ?? `Upload failed (${xhr.status})`
        )
      )
    })
    xhr.addEventListener("error", () => reject(new Error("Upload connection failed.")))
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled.")))

    const form = new FormData()
    form.append("file", payload.file)
    form.append("document_type", payload.documentType)
    if (payload.title?.trim()) form.append("title", payload.title.trim())
    if (payload.district?.trim()) form.append("district", payload.district.trim())
    xhr.send(form)
  })
  return { promise, abort: () => xhr.abort() }
}
