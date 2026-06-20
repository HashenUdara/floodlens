"use client"

import { useEffect, useState } from "react"
import { Bot, ExternalLink, FolderOpen } from "lucide-react"

import {
  documentFileUrl,
  DocumentSummary,
  getDocumentSummary,
  KnowledgeDocument,
  listDocuments,
} from "@/lib/documents"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function ResponseDocuments({
  onAskCopilot,
  onManageDocuments,
}: {
  onAskCopilot: (document: KnowledgeDocument) => void
  onManageDocuments: () => void
}) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [summary, setSummary] = useState<DocumentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    async function loadDocuments() {
      setLoading(true)
      try {
        const [documentList, documentSummary] = await Promise.all([
          listDocuments({ limit: 25 }),
          getDocumentSummary(),
        ])
        if (ignore) return
        setDocuments(documentList)
        setSummary(documentSummary)
        setError(null)
      } catch (err: unknown) {
        if (ignore) return
        setError(err instanceof Error ? err.message : "Could not load documents")
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    void loadDocuments()

    return () => {
      ignore = true
    }
  }, [])

  return (
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle>Response Documents</CardTitle>
          <CardDescription>
            SOPs, policies, and field reports used as response evidence.
          </CardDescription>
          <CardAction>
            <Button type="button" variant="outline" size="sm" onClick={onManageDocuments}>
              Manage documents
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <DocumentMetric
                label="Ready documents"
                value={summary?.ready ?? 0}
                detail="available for briefing"
                loading={loading}
              />
              <DocumentMetric
                label="Total documents"
                value={summary?.total ?? 0}
                detail="uploaded evidence"
                loading={loading}
              />
              <DocumentMetric
                label="In review"
                value={summary?.indexing ?? 0}
                detail="being prepared"
                loading={loading}
              />
              <DocumentMetric
                label="Latest update"
                value={summary?.latest_indexed_at ? "available" : 0}
                detail={summary?.latest_indexed_at ?? "no document indexed yet"}
                loading={loading}
              />
            </div>
          )}
          <div className="mt-4 rounded-lg border border-border p-3 text-sm text-muted-foreground">
            Uploads and technical indexing controls are kept in Model Ops. This view
            is for opening documents and asking Copilot for plain-language guidance.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available evidence</CardTitle>
          <CardDescription>Open a document or ask Copilot to apply it.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>District</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-7 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : documents.length ? (
                documents.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell>
                      <div className="font-medium">{document.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {document.original_filename}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">
                      {document.document_type.replaceAll("_", " ")}
                    </TableCell>
                    <TableCell>{document.district ?? "National"}</TableCell>
                    <TableCell>
                      <Badge variant={document.status === "ready" ? "secondary" : "outline"}>
                        {document.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={document.status !== "ready"}
                          onClick={() => onAskCopilot(document)}
                        >
                          <Bot /> Ask
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={document.status !== "ready"}
                          onClick={() => window.open(documentFileUrl(document.id), "_blank")}
                        >
                          <ExternalLink /> Open
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No response documents uploaded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function DocumentMetric({
  label,
  value,
  detail,
  loading,
}: {
  label: string
  value: string | number
  detail: string
  loading: boolean
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <FolderOpen className="size-3.5" />
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <div className="mt-2 truncate text-2xl font-semibold tracking-tight">
          {value}
        </div>
      )}
      <div className="mt-1 truncate text-xs text-muted-foreground">{detail}</div>
    </div>
  )
}
