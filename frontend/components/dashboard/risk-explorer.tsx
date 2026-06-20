import { useMemo } from "react"
import type { FeatureCollection, Point } from "geojson"
import {
  Filter,
  Layers3,
  Loader2,
  LocateFixed,
  Play,
  Search,
  ShieldCheck,
  Table2,
} from "lucide-react"

import { FeedbackRating, LocationRow, ObservedOutcome } from "@/lib/api"
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
  Map,
  MapClusterLayer,
  MapControls,
  MapMarker,
  MapPopup,
  MarkerContent,
  MarkerTooltip,
} from "@/components/ui/map"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ALL_DISTRICTS,
  LocationFeatureProperties,
  ServedScore,
} from "@/components/dashboard/types"
import {
  formatCompact,
  formatUnit,
  InfoLine,
  RiskBadge,
  riskMarkerClass,
} from "@/components/dashboard/shared"
import { FeedbackControls } from "@/components/dashboard/feedback-controls"
import { cn } from "@/lib/utils"

export function RiskExplorer({
  districts,
  district,
  search,
  locations,
  selectedLocation,
  predictions,
  loading,
  predictingRecordId,
  feedbackSubmittingRecordId,
  onDistrictChange,
  onSearchChange,
  onSelectLocation,
  onPredictLocation,
  onSubmitFeedback,
}: {
  districts: string[]
  district: string
  search: string
  locations: LocationRow[]
  selectedLocation: LocationRow | null
  predictions: Record<string, ServedScore>
  loading: boolean
  predictingRecordId: string | null
  feedbackSubmittingRecordId: string | null
  onDistrictChange: (district: string) => void
  onSearchChange: (search: string) => void
  onSelectLocation: (recordId: string) => void
  onPredictLocation: (recordId: string) => void
  onSubmitFeedback: (payload: {
    recordId: string
    modelVersion: string
    rating: FeedbackRating
    observedOutcome: ObservedOutcome
  }) => Promise<void>
}) {
  const features = useMemo<FeatureCollection<Point, LocationFeatureProperties>>(
    () => ({
      type: "FeatureCollection",
      features: locations.map((location) => ({
        type: "Feature",
        properties: {
          record_id: location.record_id,
          district: location.district,
          place_name: location.place_name,
        },
        geometry: {
          type: "Point",
          coordinates: [location.map_longitude, location.map_latitude],
        },
      })),
    }),
    [locations]
  )

  const selectedPrediction = selectedLocation
    ? predictions[selectedLocation.record_id]
    : null

  return (
    <div className="w-full">
      <div className="space-y-4">
        <Card>
          <CardHeader className="gap-3">
            <div>
              <CardTitle>Risk Map</CardTitle>
              <CardDescription>
                Explore places under watch, inspect risk reasons, and choose
                the next action.
              </CardDescription>
            </div>
            <CardAction className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1.5">
                <Layers3 className="size-3" />
                {locations.length} monitored places
              </Badge>
              <Badge variant="outline" className="gap-1.5">
                <Filter className="size-3" />
                {district === ALL_DISTRICTS ? "All districts" : district}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
              <div className="space-y-2">
                <Label>District</Label>
                <Select
                  value={district}
                  onValueChange={(value) => {
                    if (value) onDistrictChange(value)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All districts" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value={ALL_DISTRICTS}>All districts</SelectItem>
                    {districts.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location-search">Search</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="location-search"
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Search place, record, or district"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <Alert>
              <ShieldCheck className="size-4" />
              <AlertTitle>Decision layer active</AlertTitle>
              <AlertDescription>
                Locations are normalized into monitored places. Map points use
                corrected presentation coordinates while risk reasons, priority,
                and recommendations stay tied to the underlying place record.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <SriLankaRiskMap
                locations={locations}
                featureCollection={features}
                selectedLocation={selectedLocation}
                selectedPrediction={selectedPrediction}
                loading={loading}
                onSelectLocation={onSelectLocation}
              />
              <LocationInspector
                location={selectedLocation}
                prediction={selectedPrediction}
                predicting={predictingRecordId === selectedLocation?.record_id}
                feedbackSubmitting={
                  feedbackSubmittingRecordId === selectedLocation?.record_id
                }
                onPredictLocation={onPredictLocation}
                onSubmitFeedback={onSubmitFeedback}
              />
            </div>
          </CardContent>
        </Card>

        <RiskTable
          locations={locations}
          selectedRecordId={selectedLocation?.record_id ?? null}
          predictions={predictions}
          loading={loading}
          predictingRecordId={predictingRecordId}
          onSelectLocation={onSelectLocation}
          onPredictLocation={onPredictLocation}
        />
      </div>
    </div>
  )
}

function SriLankaRiskMap({
  locations,
  featureCollection,
  selectedLocation,
  selectedPrediction,
  loading,
  onSelectLocation,
}: {
  locations: LocationRow[]
  featureCollection: FeatureCollection<Point, LocationFeatureProperties>
  selectedLocation: LocationRow | null
  selectedPrediction: ServedScore | null
  loading: boolean
  onSelectLocation: (recordId: string) => void
}) {
  return (
    <div className="relative h-[560px] overflow-hidden rounded-lg border border-border bg-muted/20">
      <Map
        theme="dark"
        center={[80.7718, 7.8731]}
        zoom={6.95}
        minZoom={6}
        maxZoom={15}
        pitch={0}
        loading={loading}
      >
        <MapClusterLayer<LocationFeatureProperties>
          data={featureCollection}
          clusterRadius={44}
          clusterMaxZoom={10}
          clusterColors={["#0f766e", "#a16207", "#be123c"]}
          clusterThresholds={[25, 100]}
          pointColor="#67e8f9"
          onPointClick={(feature) => {
            if (feature.properties?.record_id) {
              onSelectLocation(feature.properties.record_id)
            }
          }}
        />
        {selectedLocation ? (
          <>
            <MapMarker
              longitude={selectedLocation.map_longitude}
              latitude={selectedLocation.map_latitude}
              onClick={() => onSelectLocation(selectedLocation.record_id)}
            >
              <MarkerContent>
                <div
                  className={cn(
                    "relative size-5 rounded-full border-2 border-background shadow-lg ring-4",
                    riskMarkerClass(
                      selectedPrediction?.risk_level ??
                        selectedLocation.baseline_risk_level
                    )
                  )}
                />
              </MarkerContent>
              <MarkerTooltip>
                {selectedLocation.place_name}, {selectedLocation.district}
              </MarkerTooltip>
            </MapMarker>
            <MapPopup
              longitude={selectedLocation.map_longitude}
              latitude={selectedLocation.map_latitude}
              closeButton
              className="w-64"
            >
              <div className="space-y-2">
                <div>
                  <div className="font-medium">{selectedLocation.place_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedLocation.district} / {selectedLocation.record_id}
                  </div>
                </div>
                {selectedPrediction ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-lg">
                      {selectedPrediction.flood_risk_score.toFixed(4)}
                    </span>
                    <RiskBadge level={selectedPrediction.risk_level} />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-lg">
                      {selectedLocation.baseline_risk_score.toFixed(4)}
                    </span>
                    <RiskBadge level={selectedLocation.baseline_risk_level} />
                  </div>
                )}
              </div>
            </MapPopup>
          </>
        ) : null}
        <MapControls
          position="top-right"
          showZoom
          showCompass
          showFullscreen
        />
      </Map>

      <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-border bg-background/90 px-3 py-2 text-xs shadow-sm backdrop-blur">
        <div className="flex items-center gap-2 text-muted-foreground">
          <LocateFixed className="size-3.5 text-cyan-300" />
          Sri Lanka monitored places layer
        </div>
        <div className="mt-1 font-mono text-foreground">
          {locations.length.toLocaleString()} corrected map points
        </div>
      </div>
    </div>
  )
}

function LocationInspector({
  location,
  prediction,
  predicting,
  feedbackSubmitting,
  onPredictLocation,
  onSubmitFeedback,
}: {
  location: LocationRow | null
  prediction: ServedScore | null
  predicting: boolean
  feedbackSubmitting: boolean
  onPredictLocation: (recordId: string) => void
  onSubmitFeedback: (payload: {
    recordId: string
    modelVersion: string
    rating: FeedbackRating
    observedOutcome: ObservedOutcome
  }) => Promise<void>
}) {
  if (!location) {
    return (
      <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
        Select a map point or table row to inspect a location.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{location.place_name}</div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">
            {location.record_id} / {location.asset_type}
          </div>
        </div>
        <RiskBadge level={prediction?.risk_level ?? location.baseline_risk_level} />
      </div>

      <Separator className="my-4" />

      <div className="mb-4 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Operational priority</span>
          <Badge variant="outline">{location.operational_priority}</Badge>
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <div className="font-mono text-3xl font-semibold">
              {(prediction?.flood_risk_score ?? location.baseline_risk_score).toFixed(4)}
            </div>
            <div className="text-xs text-muted-foreground">
              {prediction ? "Current risk score" : "Baseline risk score"}
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {prediction ? "latest review" : "baseline"}
          </div>
        </div>
      </div>

      <div className="grid gap-2 text-sm">
        <InfoLine label="District" value={location.district} />
        <InfoLine
          label="Map coordinates"
          value={`${location.map_latitude.toFixed(4)}, ${location.map_longitude.toFixed(4)}`}
        />
        <InfoLine
          label="Raw data coordinates"
          value={`${location.raw_latitude.toFixed(4)}, ${location.raw_longitude.toFixed(4)}`}
        />
        <InfoLine
          label="Coordinate source"
          value={location.coordinate_source.replaceAll("_", " ")}
        />
        <InfoLine label="Rainfall 7d" value={formatUnit(location.rainfall_7d_mm, "mm")} />
        <InfoLine label="Elevation" value={formatUnit(location.elevation_m, "m")} />
        <InfoLine
          label="River distance"
          value={formatUnit(location.distance_to_river_m, "m")}
        />
        <InfoLine label="Evacuation" value={formatUnit(location.nearest_evac_km, "km")} />
        <InfoLine
          label="Population density"
          value={formatUnit(location.population_density_per_km2, "/km2")}
        />
      </div>

      <Separator className="my-4" />

      <div className="mb-4 space-y-3">
        <div>
          <div className="mb-2 text-xs text-muted-foreground">Risk drivers</div>
          <div className="flex flex-wrap gap-2">
            {location.risk_drivers.length ? (
              location.risk_drivers.map((driver) => (
                <Badge key={driver} variant="outline">
                  {driver}
                </Badge>
              ))
            ) : (
              <Badge variant="outline">No strong driver</Badge>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-border p-3 text-sm">
          <div className="mb-1 text-xs text-muted-foreground">Recommended action</div>
          <p>{location.recommended_action}</p>
        </div>
      </div>

      <Button
        type="button"
        className="w-full"
        onClick={() => onPredictLocation(location.record_id)}
        disabled={predicting}
      >
        {predicting ? <Loader2 className="animate-spin" /> : <Play />}
        Refresh risk
      </Button>

      {prediction?.record_id ? (
        <div className="mt-3">
          <FeedbackControls
            recordId={prediction.record_id}
            modelVersion={prediction.model_version}
            disabled={feedbackSubmitting}
            onSubmit={onSubmitFeedback}
          />
        </div>
      ) : null}
    </div>
  )
}

function RiskTable({
  locations,
  selectedRecordId,
  predictions,
  loading,
  predictingRecordId,
  onSelectLocation,
  onPredictLocation,
}: {
  locations: LocationRow[]
  selectedRecordId: string | null
  predictions: Record<string, ServedScore>
  loading: boolean
  predictingRecordId: string | null
  onSelectLocation: (recordId: string) => void
  onPredictLocation: (recordId: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Table2 className="size-4 text-cyan-300" />
          Operational risk queue
        </CardTitle>
        <CardDescription>
          Prioritize monitored places using current risk signals and review
          the places that need attention.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[440px] rounded-lg border border-border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Record</TableHead>
                <TableHead>District</TableHead>
                <TableHead>Place</TableHead>
                <TableHead className="text-right">Rainfall</TableHead>
                <TableHead className="text-right">Elevation</TableHead>
                <TableHead className="text-right">River</TableHead>
                <TableHead className="text-right">Evac</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={10}>
                      <Skeleton className="h-7 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : locations.length ? (
                locations.map((location) => {
                  const prediction = predictions[location.record_id]
                  const selected = selectedRecordId === location.record_id
                  const predicting = predictingRecordId === location.record_id

                  return (
                    <TableRow
                      key={location.record_id}
                      data-state={selected ? "selected" : undefined}
                      className="cursor-pointer"
                      onClick={() => onSelectLocation(location.record_id)}
                    >
                      <TableCell className="font-mono text-xs">
                        {location.record_id}
                      </TableCell>
                      <TableCell>{location.district}</TableCell>
                      <TableCell className="max-w-52 truncate">
                        {location.place_name}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatCompact(location.rainfall_7d_mm)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatCompact(location.elevation_m)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatCompact(location.distance_to_river_m)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatCompact(location.nearest_evac_km)}
                      </TableCell>
                      <TableCell>
                        <BusinessRiskStack
                          baselineScore={location.baseline_risk_score}
                          baselineLevel={location.baseline_risk_level}
                          latestScore={prediction}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{location.operational_priority}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={predicting}
                          onClick={(event) => {
                            event.stopPropagation()
                            onPredictLocation(location.record_id)
                          }}
                        >
                          {predicting ? <Loader2 className="animate-spin" /> : <Play />}
                          Refresh
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                    No matching locations.
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

function BusinessRiskStack({
  baselineScore,
  baselineLevel,
  latestScore,
}: {
  baselineScore: number
  baselineLevel: LocationRow["baseline_risk_level"]
  latestScore?: ServedScore
}) {
  const activeLevel = latestScore?.risk_level ?? baselineLevel
  const activeScore = latestScore?.flood_risk_score ?? baselineScore

  return (
    <div className="min-w-32 space-y-1.5">
      <RiskBadge level={activeLevel} />
      <div className="grid gap-0.5 font-mono text-[11px] leading-4 text-muted-foreground">
        <span>{activeScore.toFixed(4)}</span>
        <span>{latestScore ? "latest review" : "baseline"}</span>
      </div>
    </div>
  )
}
