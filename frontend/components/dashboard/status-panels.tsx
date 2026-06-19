import { FormEvent } from "react"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  DatabaseZap,
  Gauge,
  Loader2,
  Play,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react"

import {
  DriftSummary,
  FeedbackRating,
  FeedbackSummary,
  ModelInfo,
  MonitoringSummary,
  ObservedOutcome,
  PredictionResult,
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
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { ApiState } from "@/components/dashboard/types"
import {
  EmptyLine,
  formatDate,
  formatNullable,
  formatNumber,
  formatTime,
  InfoRow,
  InfoSkeleton,
  MetricCard,
  RiskBadge,
  RiskBar,
} from "@/components/dashboard/shared"
import { FeedbackControls } from "@/components/dashboard/feedback-controls"

export function MetricGrid({
  modelInfo,
  monitoring,
  loading,
}: {
  modelInfo: ModelInfo | null
  monitoring: MonitoringSummary | null
  loading: boolean
}) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      <MetricCard
        icon={<BrainCircuit />}
        label="Model version"
        value={modelInfo?.model_version ?? "-"}
        detail={`${modelInfo?.feature_count ?? "-"} features`}
        loading={loading}
      />
      <MetricCard
        icon={<Gauge />}
        label="OOF MAE"
        value={formatNumber(modelInfo?.metrics.oof_mae, 6)}
        detail={`RMSE ${formatNumber(modelInfo?.metrics.oof_rmse, 6)}`}
        loading={loading}
      />
      <MetricCard
        icon={<DatabaseZap />}
        label="Predictions"
        value={monitoring?.total_predictions ?? 0}
        detail={`${monitoring?.single_prediction_count ?? 0} single / ${monitoring?.batch_prediction_count ?? 0} batch`}
        loading={loading}
      />
      <MetricCard
        icon={<Activity />}
        label="Average risk"
        value={formatNullable(monitoring?.average_risk_score)}
        detail="from logged predictions"
        loading={loading}
      />
      <MetricCard
        icon={<AlertTriangle />}
        label="High risk"
        value={monitoring?.high_risk_count ?? 0}
        detail="logged locations"
        loading={loading}
      />
      <MetricCard
        icon={<ShieldCheck />}
        label="Latest event"
        value={formatTime(monitoring?.latest_prediction_at)}
        detail={monitoring?.latest_batch_id ?? "prediction log"}
        loading={loading}
      />
    </section>
  )
}

export function OverviewPanel({
  apiState,
  modelInfo,
  monitoring,
  riskTotal,
  loading,
}: {
  apiState: ApiState
  modelInfo: ModelInfo | null
  monitoring: MonitoringSummary | null
  riskTotal: number
  loading: boolean
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
      <Card>
        <CardHeader>
          <CardTitle>Operations readiness</CardTitle>
          <CardDescription>
            Current service state and active model context for today&apos;s risk review.
          </CardDescription>
          <CardAction>
            <Badge variant="secondary">{apiState}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {loading || !modelInfo ? (
            <InfoSkeleton />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Active model" value={modelInfo.model_version} />
              <InfoRow label="Last trained" value={formatDate(modelInfo.trained_at)} />
              <InfoRow label="Training records" value={modelInfo.metrics.n_train.toLocaleString()} />
              <InfoRow label="Risk signals" value={modelInfo.feature_count.toString()} />
              <InfoRow label="Validation RMSE" value={formatNumber(modelInfo.metrics.oof_rmse, 4)} />
              <InfoRow label="Serving API" value={apiState} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prediction activity mix</CardTitle>
          <CardDescription>
            Risk levels observed from served predictions and logged API activity.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loading || !monitoring ? (
            <InfoSkeleton />
          ) : (
            <>
              <RiskBar
                label="Low"
                value={monitoring.low_risk_count}
                total={riskTotal}
                className="bg-emerald-400"
              />
              <RiskBar
                label="Medium"
                value={monitoring.medium_risk_count}
                total={riskTotal}
                className="bg-amber-400"
              />
              <RiskBar
                label="High"
                value={monitoring.high_risk_count}
                total={riskTotal}
                className="bg-rose-400"
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function PredictionPanel({
  payload,
  prediction,
  predicting,
  onPayloadChange,
  onResetPayload,
  onPredict,
  feedbackSubmittingRecordId,
  onSubmitFeedback,
}: {
  payload: string
  prediction: PredictionResult | null
  predicting: boolean
  onPayloadChange: (payload: string) => void
  onResetPayload: () => void
  onPredict: (event: FormEvent<HTMLFormElement>) => void
  feedbackSubmittingRecordId: string | null
  onSubmitFeedback: (payload: {
    recordId: string
    modelVersion: string
    rating: FeedbackRating
    observedOutcome: ObservedOutcome
  }) => Promise<void>
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.7fr]">
      <Card>
        <CardHeader>
          <CardTitle>Model Serving Lab</CardTitle>
          <CardDescription>
            Verify the deployed model API with a full monitored-place payload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onPredict}>
            <div className="space-y-2">
              <Label htmlFor="prediction-payload">API payload</Label>
              <Textarea
                id="prediction-payload"
                value={payload}
                onChange={(event) => onPayloadChange(event.target.value)}
                className="min-h-[430px] resize-y font-mono text-xs leading-5"
                spellCheck={false}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={predicting}>
                {predicting ? <Loader2 className="animate-spin" /> : <Play />}
                Call model API
              </Button>
              <Button type="button" variant="outline" onClick={onResetPayload}>
                Reset sample
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Serving response</CardTitle>
          <CardDescription>
            Latest model score, risk level, version, and logging status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {prediction ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm text-muted-foreground">
                    {prediction.record_id}
                  </p>
                  <p className="mt-2 text-5xl font-semibold tracking-tight">
                    {prediction.flood_risk_score.toFixed(6)}
                  </p>
                </div>
                <RiskBadge level={prediction.risk_level} />
              </div>
              <Separator />
              <div className="grid gap-3 text-sm">
                <InfoRow label="Served model" value={prediction.model_version} />
                <InfoRow label="Risk level" value={prediction.risk_level} />
                <InfoRow label="Operations log" value="event logged" />
              </div>
              {prediction.record_id ? (
                <FeedbackControls
                  recordId={prediction.record_id}
                  modelVersion={prediction.model_version}
                  disabled={feedbackSubmittingRecordId === prediction.record_id}
                  onSubmit={onSubmitFeedback}
                />
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
              No model-serving request submitted in this browser session.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function MonitoringPanel({
  monitoring,
  feedbackSummary,
  driftSummary,
}: {
  monitoring: MonitoringSummary | null
  feedbackSummary: FeedbackSummary | null
  driftSummary: DriftSummary | null
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle>Model Operations</CardTitle>
          <CardDescription>
            Serving volume, feedback loop status, and retraining signals.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {monitoring ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <InfoRow
                  label="Single requests"
                  value={monitoring.single_prediction_count.toLocaleString()}
                />
                <InfoRow
                  label="Batch predictions"
                  value={monitoring.batch_prediction_count.toLocaleString()}
                />
                <InfoRow
                  label="Batch runs"
                  value={monitoring.batch_run_count.toLocaleString()}
                />
                <InfoRow
                  label="Latest batch"
                  value={monitoring.latest_batch_id ?? "-"}
                />
              </div>
              <Separator />
              <div className="grid gap-2 sm:grid-cols-2">
                <InfoRow
                  label="Feedback"
                  value={(feedbackSummary?.total_feedback ?? 0).toLocaleString()}
                />
                <InfoRow
                  label="Disagreement"
                  value={`${((feedbackSummary?.disagreement_rate ?? 0) * 100).toFixed(1)}%`}
                />
                <InfoRow
                  label="Drift status"
                  value={formatStatus(driftSummary?.status)}
                />
                <InfoRow
                  label="Retraining"
                  value={
                    feedbackSummary?.retraining_candidate ||
                    driftSummary?.status === "retraining_candidate"
                      ? "candidate"
                      : "not required"
                  }
                />
              </div>
              <Separator />
              {Object.keys(monitoring.model_versions).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(monitoring.model_versions).map(([version, count]) => (
                    <div key={version} className="flex items-center justify-between gap-3">
                      <span className="font-mono text-sm">{version}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyLine />
              )}
            </>
          ) : (
            <EmptyLine />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prediction demand by district</CardTitle>
          <CardDescription>
            Districts receiving the most model-serving activity.
          </CardDescription>
          <CardAction>
            <BarChart3 className="size-4 text-muted-foreground" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>District</TableHead>
                <TableHead className="text-right">Predictions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monitoring?.top_districts_by_predictions.length ? (
                monitoring.top_districts_by_predictions.map((item) => (
                  <TableRow key={item.district}>
                    <TableCell>{item.district}</TableCell>
                    <TableCell className="text-right font-mono">
                      {item.count}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="text-muted-foreground">
                    No district activity logged yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feedback outcomes</CardTitle>
          <CardDescription>
            Human review and observed flood outcomes from scored locations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedbackSummary ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <InfoRow
                  label="Useful"
                  value={feedbackSummary.useful_count.toLocaleString()}
                />
                <InfoRow
                  label="Not useful"
                  value={feedbackSummary.not_useful_count.toLocaleString()}
                />
                <InfoRow
                  label="Observed flood"
                  value={feedbackSummary.observed_flood_count.toLocaleString()}
                />
                <InfoRow
                  label="No flood"
                  value={feedbackSummary.observed_no_flood_count.toLocaleString()}
                />
              </div>
              <Separator />
              {feedbackSummary.top_feedback_districts.length ? (
                <div className="space-y-2">
                  {feedbackSummary.top_feedback_districts.map((item) => (
                    <div
                      key={item.district}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span>{item.district}</span>
                      <Badge variant="outline">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyLine />
              )}
            </>
          ) : (
            <EmptyLine />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Drift watch</CardTitle>
          <CardDescription>
            Recent scored records compared with the seed reference distribution.
          </CardDescription>
          <CardAction>
            <Badge variant="outline" className="gap-1.5">
              <RefreshCcw className="size-3" />
              {formatStatus(driftSummary?.status)}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {driftSummary ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <InfoRow
                  label="Recent sample"
                  value={driftSummary.sample_size.toLocaleString()}
                />
                <InfoRow
                  label="Reference"
                  value={driftSummary.reference_size.toLocaleString()}
                />
                <InfoRow
                  label="Risk shift"
                  value={formatNullable(driftSummary.risk_score_shift.absolute_difference)}
                />
                <InfoRow
                  label="District shift"
                  value={formatNullable(driftSummary.district_shift.absolute_difference)}
                />
              </div>
              <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
                {driftSummary.recommendation}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    <TableHead className="text-right">Recent</TableHead>
                    <TableHead className="text-right">Reference</TableHead>
                    <TableHead className="text-right">Shift</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {driftSummary.feature_warnings.length ? (
                    driftSummary.feature_warnings.map((item) => (
                      <TableRow key={item.feature}>
                        <TableCell>{item.feature.replaceAll("_", " ")}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(item.recent_mean, 2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(item.reference_mean, 2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">
                            {(item.relative_change * 100).toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        No feature warnings for the current sample.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </>
          ) : (
            <EmptyLine />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function formatStatus(value: DriftSummary["status"] | undefined) {
  return value ? value.replaceAll("_", " ") : "-"
}
