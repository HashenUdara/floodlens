import { RadioTower, TerminalSquare } from "lucide-react"

import { ApiState } from "@/components/dashboard/types"
import { SystemMonitoringSummary } from "@/lib/api"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { InfoRow } from "@/components/dashboard/shared"

const ENDPOINTS = [
  "GET /health",
  "GET /model-info",
  "POST /predict",
  "POST /batch-predict",
  "GET /monitoring/summary",
  "GET /feedback/summary",
  "GET /monitoring/drift",
  "GET /documents/summary",
  "POST /scenario/simulate",
  "POST /reports/action",
]

export function DeveloperToolsPanel({
  apiState,
  modelVersion,
  systemMonitoring,
}: {
  apiState: ApiState
  modelVersion?: string
  systemMonitoring: SystemMonitoringSummary | null
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TerminalSquare className="size-4 text-cyan-300" />
            Developer Tools
          </CardTitle>
          <CardDescription>
            Readiness details and troubleshooting pointers for the demo system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <InfoRow label="API state" value={apiState} />
          <InfoRow label="Served model" value={modelVersion ?? "pending"} />
          <InfoRow
            label="Requests logged"
            value={(systemMonitoring?.total_requests ?? 0).toLocaleString()}
          />
          <InfoRow
            label="Errors"
            value={(systemMonitoring?.error_count ?? 0).toLocaleString()}
          />
          <InfoRow
            label="Retrieval events"
            value={(systemMonitoring?.retrieval_events ?? 0).toLocaleString()}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RadioTower className="size-4 text-cyan-300" />
            API surface
          </CardTitle>
          <CardDescription>
            Backend endpoints used by the dashboard and Copilot tools.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {ENDPOINTS.map((endpoint) => (
              <Badge key={endpoint} variant="outline" className="font-mono">
                {endpoint}
              </Badge>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-border p-3 text-sm text-muted-foreground">
            Keep raw endpoint checks here. Business users should stay in Command
            Center where the same data is translated into risk, priority, and action.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
