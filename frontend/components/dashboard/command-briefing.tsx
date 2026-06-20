import type { ReactNode } from "react"
import { ArrowRight, Bot, ClipboardList, FileText, MapPinned } from "lucide-react"

import {
  DistrictSummary,
  EmergencyPriorityLocation,
  HighRiskLocation,
  MonitoringSummary,
} from "@/lib/api"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ActiveView } from "@/components/dashboard/types"
import { CompactDriverList, DecisionMetric, RiskBadge } from "@/components/dashboard/shared"

export function CommandBriefing({
  summaries,
  priorityLocations,
  highRiskLocations,
  monitoring,
  loading,
  onNavigate,
  onOpenLocation,
  onDistrictChange,
}: {
  summaries: DistrictSummary[]
  priorityLocations: EmergencyPriorityLocation[]
  highRiskLocations: HighRiskLocation[]
  monitoring: MonitoringSummary | null
  loading: boolean
  onNavigate: (view: ActiveView) => void
  onOpenLocation: (recordId: string, district?: string) => void
  onDistrictChange: (district: string) => void
}) {
  const highestRiskDistrict = summaries[0]
  const totalPlaces = summaries.reduce(
    (total, summary) => total + summary.monitored_places,
    0
  )
  const highRiskCount = summaries.reduce(
    (total, summary) => total + summary.high_risk_count,
    0
  )
  const priorityCount = summaries.reduce(
    (total, summary) =>
      total + summary.critical_priority_count + summary.elevated_priority_count,
    0
  )
  const topPriority = priorityLocations[0]
  const topRisk = highRiskLocations[0]

  return (
    <div className="grid gap-4 2xl:grid-cols-[1.05fr_0.95fr]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s attention</CardTitle>
            <CardDescription>
              The current risk picture for places under watch.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DecisionMetric
                label="Highest-risk district"
                value={highestRiskDistrict?.district ?? "-"}
                detail={
                  highestRiskDistrict
                    ? `${highestRiskDistrict.average_baseline_risk_score.toFixed(4)} average risk`
                    : "waiting for district data"
                }
                loading={loading}
              />
              <DecisionMetric
                label="Places under watch"
                value={totalPlaces.toLocaleString()}
                detail="current monitored scope"
                loading={loading}
              />
              <DecisionMetric
                label="Need review"
                value={priorityCount.toLocaleString()}
                detail="critical or elevated priority"
                loading={loading}
              />
              <DecisionMetric
                label="High-risk places"
                value={highRiskCount.toLocaleString()}
                detail="across all districts"
                loading={loading}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommended next action</CardTitle>
            <CardDescription>
              One practical place to start before opening deeper views.
            </CardDescription>
            <CardAction>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onNavigate("priority-list")}
              >
                Open priority list <ArrowRight />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {topPriority ? (
              <div className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Start here</Badge>
                  <Badge variant="outline">{topPriority.district}</Badge>
                  <Badge variant="outline">{topPriority.operational_priority}</Badge>
                </div>
                <div className="mt-3 text-lg font-semibold">
                  Review {topPriority.place_name}
                </div>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  {topPriority.recommended_action}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {topPriority.priority_reasons.slice(0, 3).map((reason) => (
                    <Badge key={reason} variant="outline">
                      {reason}
                    </Badge>
                  ))}
                </div>
                <Button
                  type="button"
                  className="mt-4"
                  onClick={() =>
                    onOpenLocation(topPriority.record_id, topPriority.district)
                  }
                >
                  Open place <MapPinned />
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
                No priority places are available for the current data.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>District situation</CardTitle>
            <CardDescription>Districts sorted by current risk pressure.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>District</TableHead>
                  <TableHead className="text-right">Places</TableHead>
                  <TableHead className="text-right">High risk</TableHead>
                  <TableHead className="text-right">Need review</TableHead>
                  <TableHead>Top reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.slice(0, 6).map((summary) => (
                  <TableRow
                    key={summary.district}
                    className="cursor-pointer"
                    onClick={() => {
                      onDistrictChange(summary.district)
                      onNavigate("priority-list")
                    }}
                  >
                    <TableCell>{summary.district}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {summary.monitored_places.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {summary.high_risk_count}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {summary.critical_priority_count + summary.elevated_priority_count}
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-sm text-muted-foreground">
                      {summary.top_risk_drivers[0]?.driver ?? "No strong reason"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Priority places</CardTitle>
            <CardDescription>Top places to review first.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {priorityLocations.slice(0, 5).map((location) => (
              <button
                key={location.record_id}
                type="button"
                onClick={() => onOpenLocation(location.record_id, location.district)}
                className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{location.place_name}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {location.district} / {location.record_id}
                    </div>
                  </div>
                  <RiskBadge level={location.baseline_risk_level} />
                </div>
                <div className="mt-3">
                  <CompactDriverList drivers={location.priority_reasons} />
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                  {location.recommended_action}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reports and evidence</CardTitle>
            <CardDescription>
              Fast entry points for handover-ready materials.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <BriefingAction
              icon={<FileText />}
              label="Create an action report"
              detail={
                topRisk
                  ? `Start from ${topRisk.place_name}, ${topRisk.district}`
                  : "Open Scenario Lab and export a report"
              }
              onClick={() => onNavigate("reports")}
            />
            <BriefingAction
              icon={<ClipboardList />}
              label="Review response documents"
              detail="Open SOPs, policies, and field evidence"
              onClick={() => onNavigate("response-documents")}
            />
            <BriefingAction
              icon={<Bot />}
              label="Ask Copilot"
              detail="Turn risk evidence into a plain-language brief"
              onClick={() => onNavigate("copilot")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Review status</CardTitle>
            <CardDescription>Recent risk reviews completed in the workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <DecisionMetric
                label="Reviews logged"
                value={(monitoring?.total_predictions ?? 0).toLocaleString()}
                detail="places scored or assessed"
                loading={loading}
              />
              <DecisionMetric
                label="Latest review"
                value={monitoring?.latest_prediction_at ? "available" : "-"}
                detail={monitoring?.latest_prediction_at ?? "no review logged yet"}
                loading={loading}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function BriefingAction({
  icon,
  label,
  detail,
  onClick,
}: {
  icon: ReactNode
  label: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent/40"
    >
      <span className="text-cyan-300 [&_svg]:size-4">{icon}</span>
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        <span className="block truncate text-sm text-muted-foreground">{detail}</span>
      </span>
    </button>
  )
}
