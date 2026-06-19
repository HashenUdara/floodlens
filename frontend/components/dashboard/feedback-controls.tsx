import { useState } from "react"
import { CheckCircle2, Loader2, ThumbsDown, ThumbsUp } from "lucide-react"

import type { FeedbackRating, ObservedOutcome } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function FeedbackControls({
  recordId,
  modelVersion,
  disabled,
  onSubmit,
}: {
  recordId: string | null | undefined
  modelVersion: string | null | undefined
  disabled?: boolean
  onSubmit: (payload: {
    recordId: string
    modelVersion: string
    rating: FeedbackRating
    observedOutcome: ObservedOutcome
  }) => Promise<void>
}) {
  const [rating, setRating] = useState<FeedbackRating>("useful")
  const [observedOutcome, setObservedOutcome] =
    useState<ObservedOutcome>("unknown")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const canSubmit = Boolean(recordId && modelVersion && !disabled && !submitting)

  async function handleSubmit() {
    if (!recordId || !modelVersion) return
    setSubmitting(true)
    setSubmitted(false)
    try {
      await onSubmit({
        recordId,
        modelVersion,
        rating,
        observedOutcome,
      })
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Feedback loop</div>
          <div className="text-xs text-muted-foreground">
            Capture field usefulness and observed outcome.
          </div>
        </div>
        {submitted ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-300">
            <CheckCircle2 className="size-3.5" />
            Saved
          </div>
        ) : null}
      </div>

      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={rating === "useful" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setRating("useful")}
          >
            <ThumbsUp />
            Useful
          </Button>
          <Button
            type="button"
            variant={rating === "not_useful" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setRating("not_useful")}
          >
            <ThumbsDown />
            Not useful
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Observed</Label>
          <Select
            value={observedOutcome}
            onValueChange={(value) =>
              setObservedOutcome(value as ObservedOutcome)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unknown">Unknown</SelectItem>
              <SelectItem value="flooded">Flooded</SelectItem>
              <SelectItem value="not_flooded">No flood</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {submitting ? <Loader2 className="animate-spin" /> : null}
          Submit feedback
        </Button>
      </div>
    </div>
  )
}
