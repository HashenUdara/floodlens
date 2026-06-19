import { DatabaseZap, Loader2 } from "lucide-react"

import {
  DistrictSummary,
  EmergencyPriorityLocation,
  HighRiskLocation,
  LatestModelScore,
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
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ALL_DISTRICTS } from "@/components/dashboard/types"
import {
  CompactDriverList,
  DecisionMetric,
  DriverChips,
  formatNullable,
  ScoreStack,
} from "@/components/dashboard/shared"

export function DistrictCommandPanel({
  district,
  districts,
  summaries,
  highRiskLocations,
  latestScores,
  loading,
  batchScoring,
  batchStatus,
  onDistrictChange,
  onBatchScore,
  onOpenLocation,
}: {
  district: string
  districts: string[]
  summaries: DistrictSummary[]
  highRiskLocations: HighRiskLocation[]
  latestScores: Record<string, LatestModelScore>
  loading: boolean
  batchScoring: boolean
  batchStatus: string | null
  onDistrictChange: (district: string) => void
  onBatchScore: (recordIds?: string[]) => void
  onOpenLocation: (recordId: string, district?: string) => void
}) {
  const visibleSummaries =
    district === ALL_DISTRICTS
      ? summaries
      : summaries.filter((summary) => summary.district === district)
  const highestRiskDistrict = summaries[0]
  const totalPlaces = visibleSummaries.reduce(
    (total, summary) => total + summary.monitored_places,
    0
  )
  const highRiskCount = visibleSummaries.reduce(
    (total, summary) => total + summary.high_risk_count,
    0
  )
  const priorityCount = visibleSummaries.reduce(
    (total, summary) =>
      total + summary.critical_priority_count + summary.elevated_priority_count,
    0
  )
  const modelScoredCount = Object.keys(latestScores).length
  const visibleModelScoredCount = highRiskLocations.filter(
    (location) => latestScores[location.record_id]
  ).length
  const selectedDistrictAverage =
    visibleSummaries.length === 1
      ? visibleSummaries[0].average_baseline_risk_score
      : highestRiskDistrict?.average_baseline_risk_score
  const selectedDistrictLabel =
    district === ALL_DISTRICTS
      ? highestRiskDistrict?.district ?? "-"
      : district

  return (
    <div className="grid gap-4 2xl:grid-cols-[1.05fr_0.95fr]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>District Command</CardTitle>
            <CardDescription>
              District-level flood risk comparison for planning and resource allocation.
            </CardDescription>
            <CardAction className="flex flex-wrap items-center gap-2">
              <BatchScoreButton
                scoring={batchScoring}
                onBatchScore={() =>
                  onBatchScore(highRiskLocations.map((location) => location.record_id))
                }
              />
              <DecisionDistrictFilter
                district={district}
                districts={districts}
                onDistrictChange={onDistrictChange}
              />
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              <DecisionMetric
                label={district === ALL_DISTRICTS ? "Highest avg risk" : "Selected avg risk"}
                value={selectedDistrictLabel}
                detail={formatNullable(selectedDistrictAverage)}
                loading={loading}
              />
              <DecisionMetric
                label="Monitored places"
                value={totalPlaces.toLocaleString()}
                detail="current scope"
                loading={loading}
              />
              <DecisionMetric
                label="High-risk places"
                value={highRiskCount.toLocaleString()}
                detail="baseline level"
                loading={loading}
              />
              <DecisionMetric
                label="Priority places"
                value={priorityCount.toLocaleString()}
                detail="critical + elevated"
                loading={loading}
              />
              <DecisionMetric
                label="Visible scored"
                value={`${visibleModelScoredCount}/${highRiskLocations.length}`}
                detail={batchStatus ?? `${modelScoredCount} stored scores`}
                loading={loading}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>District risk ranking</CardTitle>
            <CardDescription>
              Sorted by average baseline risk score.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[460px] rounded-lg border border-border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>District</TableHead>
                    <TableHead className="text-right">Places</TableHead>
                    <TableHead className="text-right">Avg risk</TableHead>
                    <TableHead className="text-right">High</TableHead>
                    <TableHead className="text-right">Priority</TableHead>
                    <TableHead>Drivers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell colSpan={6}>
                          <Skeleton className="h-7 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : visibleSummaries.length ? (
                    visibleSummaries.map((summary) => (
                      <TableRow
                        key={summary.district}
                        className="cursor-pointer"
                        onClick={() => onDistrictChange(summary.district)}
                      >
                        <TableCell>{summary.district}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {summary.monitored_places.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {summary.average_baseline_risk_score.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {summary.high_risk_count}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {summary.critical_priority_count + summary.elevated_priority_count}
                        </TableCell>
                        <TableCell>
                          <DriverChips
                            drivers={summary.top_risk_drivers.map(
                              (driver) => `${driver.driver} (${driver.count})`
                            )}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No district summary available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <HighRiskLocationsPanel
        locations={highRiskLocations}
        latestScores={latestScores}
        loading={loading}
        onOpenLocation={onOpenLocation}
      />
    </div>
  )
}

function HighRiskLocationsPanel({
  locations,
  latestScores,
  loading,
  onOpenLocation,
}: {
  locations: HighRiskLocation[]
  latestScores: Record<string, LatestModelScore>
  loading: boolean
  onOpenLocation: (recordId: string, district?: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>High-risk locations</CardTitle>
        <CardDescription>
          Ranked monitored places by baseline risk.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[628px] rounded-lg border border-border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="w-[30%]">Place</TableHead>
                <TableHead className="w-[26%]">Risk</TableHead>
                <TableHead className="w-[14%]">Priority</TableHead>
                <TableHead className="w-[22%]">Drivers</TableHead>
                <TableHead className="w-[8%] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-7 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : locations.length ? (
                locations.map((location) => {
                  const latestScore = latestScores[location.record_id]

                  return (
                    <TableRow key={location.record_id}>
                      <TableCell>
                        <div className="font-medium">{location.place_name}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {location.district} / {location.record_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ScoreStack
                          baselineScore={location.baseline_risk_score}
                          baselineLevel={location.baseline_risk_level}
                          latestScore={latestScore}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{location.operational_priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <CompactDriverList drivers={location.risk_drivers} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenLocation(location.record_id, location.district)}
                        >
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No high-risk locations for this scope.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

export function PriorityQueuePanel({
  district,
  districts,
  priorityLocations,
  latestScores,
  loading,
  batchScoring,
  batchStatus,
  onDistrictChange,
  onBatchScore,
  onOpenLocation,
}: {
  district: string
  districts: string[]
  priorityLocations: EmergencyPriorityLocation[]
  latestScores: Record<string, LatestModelScore>
  loading: boolean
  batchScoring: boolean
  batchStatus: string | null
  onDistrictChange: (district: string) => void
  onBatchScore: (recordIds?: string[]) => void
  onOpenLocation: (recordId: string, district?: string) => void
}) {
  const visibleModelScoredCount = priorityLocations.filter(
    (location) => latestScores[location.record_id]
  ).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Emergency Priority Queue</CardTitle>
        <CardDescription>
          Response-planning order based on risk, exposure, evacuation access, history, and infrastructure.
        </CardDescription>
        <CardAction className="flex flex-wrap items-center gap-2">
          {batchStatus ? (
            <Badge variant="outline" className="max-w-48 truncate font-mono">
              {batchStatus}
            </Badge>
          ) : null}
          <BatchScoreButton
            scoring={batchScoring}
            onBatchScore={() =>
              onBatchScore(priorityLocations.map((location) => location.record_id))
            }
          />
          <DecisionDistrictFilter
            district={district}
            districts={districts}
            onDistrictChange={onDistrictChange}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{priorityLocations.length} visible</Badge>
          <Badge variant="outline">{visibleModelScoredCount} model-scored</Badge>
        </div>
        <ScrollArea className="h-[680px] rounded-lg border border-border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead className="min-w-56">Place</TableHead>
                <TableHead className="w-24">Priority score</TableHead>
                <TableHead className="min-w-40">Risk</TableHead>
                <TableHead className="w-28">Priority</TableHead>
                <TableHead className="min-w-48">Reasons</TableHead>
                <TableHead className="min-w-72">Recommended action</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-7 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : priorityLocations.length ? (
                priorityLocations.map((location) => {
                  const latestScore = latestScores[location.record_id]

                  return (
                    <TableRow key={location.record_id}>
                      <TableCell className="font-mono text-xs">
                        #{location.rank}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{location.place_name}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {location.district} / {location.record_id}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {location.emergency_priority_score.toFixed(4)}
                      </TableCell>
                      <TableCell>
                        <ScoreStack
                          baselineScore={location.baseline_risk_score}
                          baselineLevel={location.baseline_risk_level}
                          latestScore={latestScore}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{location.operational_priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <CompactDriverList drivers={location.priority_reasons} />
                      </TableCell>
                      <TableCell className="max-w-sm text-sm text-muted-foreground">
                        {location.recommended_action}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenLocation(location.record_id, location.district)}
                        >
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No priority locations for this scope.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function DecisionDistrictFilter({
  district,
  districts,
  onDistrictChange,
}: {
  district: string
  districts: string[]
  onDistrictChange: (district: string) => void
}) {
  return (
    <Select
      value={district}
      onValueChange={(value) => {
        if (value) onDistrictChange(value)
      }}
    >
      <SelectTrigger className="w-56">
        <SelectValue placeholder="All districts" />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value={ALL_DISTRICTS}>All districts</SelectItem>
        {districts.map((item) => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function BatchScoreButton({
  scoring,
  onBatchScore,
}: {
  scoring: boolean
  onBatchScore: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onBatchScore}
      disabled={scoring}
    >
      {scoring ? <Loader2 className="animate-spin" /> : <DatabaseZap />}
      Run batch scoring
    </Button>
  )
}
