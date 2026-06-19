import { ReactNode } from "react"

import { PredictionResult } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ServedScore } from "@/components/dashboard/types"

export function MetricCard({
  icon,
  label,
  value,
  detail,
  loading,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  detail: string
  loading: boolean
}) {
  return (
    <Card size="sm" className="min-h-32">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-muted-foreground">
          <span className="text-cyan-300 [&_svg]:size-4">{icon}</span>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="truncate text-2xl font-semibold tracking-tight">{value}</div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-mono text-sm">{value}</span>
    </div>
  )
}

export function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-mono text-xs">{value}</span>
    </div>
  )
}

export function RiskBar({
  label,
  value,
  total,
  className,
}: {
  label: string
  value: number
  total: number
  className: string
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono text-muted-foreground">
          {value} / {percent}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={className} style={{ width: `${percent}%`, height: "100%" }} />
      </div>
    </div>
  )
}

export function RiskBadge({
  level,
  label,
}: {
  level: PredictionResult["risk_level"]
  label?: string
}) {
  const className =
    level === "High"
      ? "border-rose-400/30 bg-rose-400/10 text-rose-300"
      : level === "Medium"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
        : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"

  return (
    <Badge variant="outline" className={className}>
      {label ?? level}
    </Badge>
  )
}

export function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  )
}

export function InfoSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-9 rounded-lg" />
      ))}
    </div>
  )
}

export function EmptyLine() {
  return (
    <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
      No prediction events logged yet.
    </div>
  )
}

export function ScoreStack({
  baselineScore,
  baselineLevel,
  latestScore,
}: {
  baselineScore: number
  baselineLevel: PredictionResult["risk_level"]
  latestScore?: ServedScore
}) {
  return (
    <div className="min-w-36 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <RiskBadge level={baselineLevel} label={`Baseline ${baselineLevel}`} />
        {latestScore ? (
          <RiskBadge
            level={latestScore.risk_level}
            label={`Model ${latestScore.risk_level}`}
          />
        ) : null}
      </div>
      <div className="grid gap-0.5 font-mono text-[11px] leading-4 text-muted-foreground">
        <span>baseline {baselineScore.toFixed(4)}</span>
        <span className={latestScore ? "text-foreground" : undefined}>
          model {latestScore ? latestScore.flood_risk_score.toFixed(4) : "not scored"}
        </span>
      </div>
    </div>
  )
}

export function DecisionMetric({
  label,
  value,
  detail,
  loading,
}: {
  label: string
  value: ReactNode
  detail: string
  loading: boolean
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <div className="mt-2 truncate text-2xl font-semibold tracking-tight">
          {value}
        </div>
      )}
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  )
}

export function DriverChips({ drivers }: { drivers: string[] }) {
  if (!drivers.length) {
    return <Badge variant="outline">No strong driver</Badge>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {drivers.slice(0, 3).map((driver) => (
        <Badge key={driver} variant="outline">
          {driver}
        </Badge>
      ))}
    </div>
  )
}

export function CompactDriverList({ drivers }: { drivers: string[] }) {
  if (!drivers.length) {
    return <span className="text-sm text-muted-foreground">No strong driver</span>
  }

  return (
    <div className="max-w-56 space-y-1 text-sm leading-5">
      {drivers.slice(0, 2).map((driver) => (
        <div key={driver} className="truncate text-muted-foreground" title={driver}>
          {driver}
        </div>
      ))}
      {drivers.length > 2 ? (
        <div className="text-xs text-muted-foreground">+{drivers.length - 2} more</div>
      ) : null}
    </div>
  )
}

export function riskMarkerClass(level?: PredictionResult["risk_level"]) {
  if (level === "High") return "bg-rose-400 ring-rose-400/25"
  if (level === "Medium") return "bg-amber-400 ring-amber-400/25"
  if (level === "Low") return "bg-emerald-400 ring-emerald-400/25"
  return "bg-cyan-300 ring-cyan-300/25"
}

export function formatNumber(value: number | undefined, digits: number) {
  return typeof value === "number" ? value.toFixed(digits) : "-"
}

export function formatNullable(value: number | null | undefined) {
  return typeof value === "number" ? value.toFixed(6) : "-"
}

export function formatCompact(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "-"
}

export function formatUnit(value: number | null | undefined, unit: string) {
  return typeof value === "number" ? `${formatCompact(value)} ${unit}` : "-"
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function formatTime(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
