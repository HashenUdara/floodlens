"use client"

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  BookOpen,
  ExternalLink,
  FileText,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react"

import {
  deleteDocument,
  documentFileUrl,
  DocumentStatus,
  DocumentSummary,
  DocumentType,
  getDocumentSummary,
  KnowledgeDocument,
  listDocuments,
  reindexDocument,
  uploadDocument,
} from "@/lib/documents"
import { ALL_DISTRICTS } from "@/components/dashboard/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ALL = "__all__"
const MAX_FILES = 5
const MAX_BYTES = 20 * 1024 * 1024
const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".md", ".markdown"]

type QueueState = "pending" | "uploading" | "uploaded" | "error" | "cancelled"

type QueueItem = {
  id: string
  file: File
  title: string
  progress: number
  state: QueueState
  error?: string
}

export function KnowledgeLibrary({
  districts,
  onAskCopilot,
}: {
  districts: string[]
  onAskCopilot: (document: KnowledgeDocument) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadControllers = useRef(new Map<string, () => void>())
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [summary, setSummary] = useState<DocumentSummary | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [documentType, setDocumentType] = useState<DocumentType>("sop")
  const [uploadDistrict, setUploadDistrict] = useState(ALL_DISTRICTS)
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [typeFilter, setTypeFilter] = useState(ALL)
  const [districtFilter, setDistrictFilter] = useState(ALL_DISTRICTS)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null)

  const loadDocuments = useCallback(async () => {
    try {
      const [nextDocuments, nextSummary] = await Promise.all([
        listDocuments({
          status: statusFilter === ALL ? undefined : (statusFilter as DocumentStatus),
          documentType: typeFilter === ALL ? undefined : (typeFilter as DocumentType),
          district:
            districtFilter === ALL_DISTRICTS ? undefined : districtFilter,
          search: search.trim() || undefined,
        }),
        getDocumentSummary(),
      ])
      setDocuments(nextDocuments)
      setSummary(nextSummary)
      setError(null)
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Knowledge Library is unavailable."
      )
    } finally {
      setLoading(false)
    }
  }, [districtFilter, search, statusFilter, typeFilter])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDocuments(), 180)
    return () => window.clearTimeout(timer)
  }, [loadDocuments])

  useEffect(() => {
    if (!documents.some((document) => ["queued", "processing"].includes(document.status))) {
      return
    }
    const timer = window.setInterval(() => void loadDocuments(), 2000)
    return () => window.clearInterval(timer)
  }, [documents, loadDocuments])

  function updateQueue(id: string, patch: Partial<QueueItem>) {
    setQueue((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    )
  }

  function addFiles(files: File[]) {
    setError(null)
    const room = Math.max(0, MAX_FILES - queue.length)
    const accepted: QueueItem[] = []
    const rejected: string[] = []

    for (const file of files.slice(0, room)) {
      const suffix = file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
      if (!ACCEPTED_EXTENSIONS.includes(suffix)) {
        rejected.push(`${file.name}: unsupported format`)
        continue
      }
      if (file.size > MAX_BYTES) {
        rejected.push(`${file.name}: exceeds 20 MB`)
        continue
      }
      accepted.push({
        id: crypto.randomUUID(),
        file,
        title: file.name.replace(/\.[^.]+$/, ""),
        progress: 0,
        state: "pending",
      })
    }
    if (files.length > room) rejected.push(`Only ${MAX_FILES} files can be queued.`)
    setQueue((current) => [...current, ...accepted])
    if (rejected.length) setError(rejected.join(" "))
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []))
    event.target.value = ""
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    addFiles(Array.from(event.dataTransfer.files))
  }

  async function uploadQueueItem(item: QueueItem) {
    updateQueue(item.id, { state: "uploading", progress: 0, error: undefined })
    const operation = uploadDocument(
      {
        file: item.file,
        title: item.title,
        documentType,
        district: uploadDistrict === ALL_DISTRICTS ? undefined : uploadDistrict,
      },
      (progress) => updateQueue(item.id, { progress })
    )
    uploadControllers.current.set(item.id, operation.abort)
    try {
      await operation.promise
      updateQueue(item.id, { state: "uploaded", progress: 100 })
    } catch (uploadError: unknown) {
      const message =
        uploadError instanceof Error ? uploadError.message : "Upload failed."
      updateQueue(item.id, {
        state: message === "Upload cancelled." ? "cancelled" : "error",
        error: message,
      })
    } finally {
      uploadControllers.current.delete(item.id)
    }
  }

  async function uploadPending() {
    const pending = queue.filter((item) =>
      ["pending", "error", "cancelled"].includes(item.state)
    )
    await Promise.all(pending.map(uploadQueueItem))
    await loadDocuments()
  }

  async function handleReindex(documentId: string) {
    setBusyDocumentId(documentId)
    try {
      await reindexDocument(documentId)
      await loadDocuments()
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Re-index failed.")
    } finally {
      setBusyDocumentId(null)
    }
  }

  async function handleDelete(documentId: string) {
    setBusyDocumentId(documentId)
    try {
      await deleteDocument(documentId)
      setDeleteConfirmId(null)
      await loadDocuments()
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Delete failed.")
    } finally {
      setBusyDocumentId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="size-4 text-cyan-300" />
            Knowledge Library
          </CardTitle>
          <CardDescription>
            Index response plans, policies, and field reports for cited Copilot evidence.
          </CardDescription>
          <CardAction>
            <Badge variant="outline">OpenAI embeddings + pgvector</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div
            onDragEnter={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`flex min-h-44 flex-col items-center justify-center border border-dashed p-6 text-center transition-colors ${
              dragging ? "border-cyan-400 bg-cyan-400/5" : "border-border bg-muted/10"
            }`}
          >
            <Upload className="size-6 text-cyan-300" />
            <div className="mt-3 text-sm font-medium">Drop operational documents here</div>
            <div className="mt-1 text-xs text-muted-foreground">
              PDF, TXT, or Markdown · 20 MB each · up to five files
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText /> Select files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
              multiple
              hidden
              onChange={handleFileInput}
            />
          </div>

          <div className="grid content-start gap-3">
            <div className="grid gap-1.5">
              <Label>Document type</Label>
              <Select
                value={documentType}
                onValueChange={(value) => value && setDocumentType(value as DocumentType)}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sop">Response SOP</SelectItem>
                  <SelectItem value="policy">Policy</SelectItem>
                  <SelectItem value="field_report">Field report</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>District scope</Label>
              <Select value={uploadDistrict} onValueChange={(value) => value && setUploadDistrict(value)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_DISTRICTS}>National / all districts</SelectItem>
                  {districts.map((district) => (
                    <SelectItem key={district} value={district}>{district}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              disabled={!queue.some((item) => ["pending", "error", "cancelled"].includes(item.state))}
              onClick={() => void uploadPending()}
            >
              <Upload /> Upload queued files
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Knowledge request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {queue.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload queue</CardTitle>
            <CardDescription>Each file uploads independently and keeps its own progress.</CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQueue((items) => items.filter((item) => item.state === "uploading"))}
              >
                Clear finished
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            {queue.map((item) => (
              <div key={item.id} className="grid gap-3 border border-border p-3 md:grid-cols-[1fr_180px_auto] md:items-center">
                <div className="min-w-0">
                  <Input
                    value={item.title}
                    disabled={item.state === "uploading" || item.state === "uploaded"}
                    onChange={(event) => updateQueue(item.id, { title: event.target.value })}
                    aria-label={`Title for ${item.file.name}`}
                  />
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {item.file.name} · {formatBytes(item.file.size)}
                  </div>
                  {item.error ? <div className="mt-1 text-xs text-destructive">{item.error}</div> : null}
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>{queueStateLabel(item.state)}</span><span>{item.progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden bg-muted">
                    <div className="h-full bg-cyan-400 transition-all" style={{ width: `${item.progress}%` }} />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title={item.state === "uploading" ? "Cancel upload" : "Remove from queue"}
                  onClick={() => {
                    if (item.state === "uploading") uploadControllers.current.get(item.id)?.()
                    else setQueue((current) => current.filter((entry) => entry.id !== item.id))
                  }}
                >
                  <X /><span className="sr-only">Remove</span>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryMetric label="Documents" value={summary?.total ?? 0} />
        <SummaryMetric label="Ready" value={summary?.ready ?? 0} />
        <SummaryMetric label="Indexing" value={summary?.indexing ?? 0} />
        <SummaryMetric label="Failed" value={summary?.failed ?? 0} />
        <SummaryMetric label="Chunks" value={summary?.chunk_count ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Indexed knowledge</CardTitle>
          <CardDescription>Search, inspect, re-index, and route evidence into Copilot.</CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => void loadDocuments()}>
              <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 lg:grid-cols-[1fr_190px_190px_220px]">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, filename, or district" className="pl-8" />
            </div>
            <FilterSelect value={statusFilter} onChange={setStatusFilter} label="All statuses" options={[
              ["queued", "Queued"], ["processing", "Processing"], ["ready", "Ready"], ["failed", "Failed"],
            ]} />
            <FilterSelect value={typeFilter} onChange={setTypeFilter} label="All types" options={[
              ["sop", "Response SOP"], ["policy", "Policy"], ["field_report", "Field report"], ["other", "Other"],
            ]} />
            <Select value={districtFilter} onValueChange={(value) => value && setDistrictFilter(value)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DISTRICTS}>All districts</SelectItem>
                {districts.map((district) => <SelectItem key={district} value={district}>{district}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-hidden border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead><TableHead>Scope</TableHead><TableHead>Status</TableHead><TableHead>Index</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell>
                      <div className="font-medium">{document.title}</div>
                      <div className="max-w-72 truncate text-xs text-muted-foreground">{document.original_filename} · {formatBytes(document.size_bytes)}</div>
                      {document.failure_message ? <div className="mt-1 max-w-md text-xs text-destructive">{document.failure_message}</div> : null}
                    </TableCell>
                    <TableCell><div>{documentTypeLabel(document.document_type)}</div><div className="text-xs text-muted-foreground">{document.district ?? "National"}</div></TableCell>
                    <TableCell><DocumentStatusBadge status={document.status} /></TableCell>
                    <TableCell><div className="font-mono text-xs">v{document.index_version}</div><div className="text-xs text-muted-foreground">{document.chunk_count} chunks</div></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button render={<a href={documentFileUrl(document.id)} target="_blank" rel="noreferrer" />} variant="ghost" size="icon-sm" title="Open source"><ExternalLink /><span className="sr-only">Open source</span></Button>
                        <Button variant="ghost" size="icon-sm" title="Ask Copilot" disabled={document.status !== "ready"} onClick={() => onAskCopilot(document)}><BookOpen /><span className="sr-only">Ask Copilot</span></Button>
                        <Button variant="ghost" size="icon-sm" title="Re-index" disabled={document.status === "queued" || document.status === "processing" || busyDocumentId === document.id} onClick={() => void handleReindex(document.id)}>{busyDocumentId === document.id ? <LoaderCircle className="animate-spin" /> : <RotateCcw />}<span className="sr-only">Re-index</span></Button>
                        {deleteConfirmId === document.id ? (
                          <><Button variant="destructive" size="sm" disabled={busyDocumentId === document.id} onClick={() => void handleDelete(document.id)}>Confirm</Button><Button variant="ghost" size="icon-sm" onClick={() => setDeleteConfirmId(null)}><X /><span className="sr-only">Cancel delete</span></Button></>
                        ) : (
                          <Button variant="ghost" size="icon-sm" title="Delete" disabled={document.status === "queued" || document.status === "processing"} onClick={() => setDeleteConfirmId(document.id)}><Trash2 /><span className="sr-only">Delete</span></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && documents.length === 0 ? <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">No documents match the current filters.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return <div className="border border-border bg-card p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</div></div>
}

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: Array<[string, string]> }) {
  return <Select value={value} onValueChange={(next) => next && onChange(next)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>{label}</SelectItem>{options.map(([option, name]) => <SelectItem key={option} value={option}>{name}</SelectItem>)}</SelectContent></Select>
}

function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge variant={status === "failed" ? "destructive" : status === "ready" ? "secondary" : "outline"} className="gap-1.5">{status === "processing" || status === "queued" ? <LoaderCircle className="size-3 animate-spin" /> : null}{status}</Badge>
}

function documentTypeLabel(type: DocumentType) {
  return { sop: "Response SOP", policy: "Policy", field_report: "Field report", other: "Other" }[type]
}

function queueStateLabel(state: QueueState) {
  return { pending: "Ready", uploading: "Uploading", uploaded: "Indexing", error: "Failed", cancelled: "Cancelled" }[state]
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
