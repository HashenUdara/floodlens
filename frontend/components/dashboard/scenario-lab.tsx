"use client"

import { useEffect, useState } from "react"
import type { Feature, Polygon } from "geojson"
import { Download, Loader2, MapPin, RotateCcw, Search, SlidersHorizontal } from "lucide-react"

import {
  downloadActionReport,
  getScenarioContext,
  LocationRow,
  ScenarioContext,
  ScenarioOverrides,
  ScenarioResult,
  simulateScenario,
} from "@/lib/api"
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
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  useMap,
} from "@/components/ui/map"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DriverChips,
  formatCompact,
  formatUnit,
  InfoLine,
  RiskBadge,
  riskMarkerClass,
} from "@/components/dashboard/shared"
import { cn } from "@/lib/utils"

const DEFAULT_BOUNDARY: Feature<Polygon> = {
  type: "Feature",
  properties: { name: "Sri Lanka scenario boundary" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [79.55, 5.85],
        [80.05, 5.78],
        [80.75, 5.88],
        [81.45, 6.15],
        [81.88, 6.55],
        [82.05, 7.25],
        [81.92, 8.05],
        [81.55, 8.75],
        [80.95, 9.55],
        [80.25, 9.9],
        [79.65, 9.8],
        [79.35, 9.25],
        [79.55, 8.35],
        [79.65, 7.45],
        [79.45, 6.75],
        [79.55, 5.85],
      ],
    ],
  },
}

const FIELD_CONFIG: Array<{
  key: keyof ScenarioOverrides
  label: string
  unit: string
  step: string
}> = [
  { key: "rainfall_7d_mm", label: "7-day rainfall", unit: "mm", step: "1" },
  { key: "monthly_rainfall_mm", label: "Monthly rainfall", unit: "mm", step: "1" },
  { key: "elevation_m", label: "Elevation", unit: "m", step: "1" },
  { key: "distance_to_river_m", label: "River distance", unit: "m", step: "10" },
  { key: "nearest_evac_km", label: "Evacuation distance", unit: "km", step: "0.1" },
  { key: "population_density_per_km2", label: "Population density", unit: "/km2", step: "1" },
  { key: "historical_flood_count", label: "Historical floods", unit: "count", step: "1" },
  { key: "infrastructure_score", label: "Infrastructure score", unit: "/100", step: "1" },
]

type ScenarioTarget =
  | { type: "record"; location: LocationRow }
  | { type: "custom"; context: ScenarioContext }

export function ScenarioLab({
  locations,
  selectedLocation,
  onSelectLocation,
  onOperationsRefresh,
}: {
  locations: LocationRow[]
  selectedLocation: LocationRow | null
  onSelectLocation: (recordId: string) => void
  onOperationsRefresh: () => Promise<void>
}) {
  const [target, setTarget] = useState<ScenarioTarget | null>(
    selectedLocation ? { type: "record", location: selectedLocation } : null
  )
  const [recordSearch, setRecordSearch] = useState(selectedLocation?.record_id ?? "")
  const [overrides, setOverrides] = useState<ScenarioOverrides>({})
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null)
  const [loadingContext, setLoadingContext] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const boundary = target?.type === "custom" ? target.context.boundary : DEFAULT_BOUNDARY
  const activeLocation =
    target?.type === "record"
      ? target.location
      : target?.type === "custom"
        ? contextToLocation(target.context)
        : null

  function selectRecord(location: LocationRow) {
    setTarget({ type: "record", location })
    setRecordSearch(location.record_id)
    setOverrides(overridesFromLocation(location))
    setScenarioResult(null)
    setMessage(null)
    onSelectLocation(location.record_id)
  }

  async function handleMapClick(latitude: number, longitude: number) {
    setLoadingContext(true)
    setMessage(null)
    try {
      const context = await getScenarioContext({ latitude, longitude })
      setTarget({ type: "custom", context })
      setRecordSearch("")
      setOverrides(context.context)
      setScenarioResult(null)
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Scenario context request failed")
    } finally {
      setLoadingContext(false)
    }
  }

  function handleSearchRecord() {
    const match = locations.find((location) => location.record_id === recordSearch.trim())
    if (!match) {
      setMessage("Record is not in the current visible location set. Use Risk Map filters to load it first.")
      return
    }
    selectRecord(match)
  }

  async function handleSimulate() {
    if (!target) return
    setSimulating(true)
    setMessage(null)
    try {
      const result = await simulateScenario(
        target.type === "record"
          ? { record_id: target.location.record_id, overrides }
          : {
              location: {
                latitude: target.context.latitude,
                longitude: target.context.longitude,
                district: target.context.district,
                place_name: target.context.place_name,
                context_source: target.context.context_source,
                ...target.context.context,
              },
              overrides,
            }
      )
      setScenarioResult(result)
      await onOperationsRefresh()
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Scenario simulation failed")
    } finally {
      setSimulating(false)
    }
  }

  async function handleExportReport() {
    if (!scenarioResult) return
    setExporting(true)
    setMessage(null)
    try {
      const blob = await downloadActionReport({ scenario: scenarioResult })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `floodlens-action-${scenarioResult.record_id || "scenario"}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Report export failed")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="gap-3">
          <div>
            <CardTitle>Scenario Lab</CardTitle>
            <CardDescription>
              Stress-test a monitored place or a validated point in Sri Lanka with editable flood assumptions.
            </CardDescription>
          </div>
          <CardAction className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1.5">
              <SlidersHorizontal className="size-3" />
              What-if simulation
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <MapPin className="size-3" />
              Sri Lanka geofence
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {message ? (
            <Alert variant={message.includes("outside") || message.includes("inside Sri Lanka") ? "destructive" : "default"}>
              <AlertTitle>Scenario notice</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
            <div className="flex flex-col gap-4">
              <div className="h-[520px] overflow-hidden rounded-lg border border-border">
                <Map
                  theme="dark"
                  center={[80.7718, 7.8731]}
                  zoom={6.6}
                  pitch={0}
                  minZoom={6}
                  maxZoom={14}
                  loading={loadingContext}
                >
                  <BoundaryLayer boundary={boundary} />
                  <MapClickHandler onMapClick={handleMapClick} />
                  <MapControls position="top-right" showZoom showCompass showFullscreen />
                  {locations.slice(0, 80).map((location) => (
                    <MapMarker
                      key={location.record_id}
                      longitude={location.map_longitude}
                      latitude={location.map_latitude}
                      onClick={(event) => {
                        event.stopPropagation()
                        selectRecord(location)
                      }}
                    >
                      <MarkerContent>
                        <div
                          className={cn(
                            "size-3 rounded-full ring-4",
                            riskMarkerClass(location.baseline_risk_level)
                          )}
                        />
                      </MarkerContent>
                      <MarkerTooltip>
                        {location.place_name} / {location.record_id}
                      </MarkerTooltip>
                    </MapMarker>
                  ))}
                  {target?.type === "custom" ? (
                    <MapMarker
                      longitude={target.context.longitude}
                      latitude={target.context.latitude}
                    >
                      <MarkerContent>
                        <div className="flex size-7 items-center justify-center rounded-full border border-cyan-200 bg-cyan-300 text-background shadow-lg">
                          <MapPin className="size-4" />
                        </div>
                      </MarkerContent>
                      <MarkerTooltip>Custom scenario point</MarkerTooltip>
                    </MapMarker>
                  ) : null}
                </Map>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Visible monitored places</CardTitle>
                  <CardDescription>Select a row to preload scenario assumptions.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64 rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Place</TableHead>
                          <TableHead>District</TableHead>
                          <TableHead>Rainfall</TableHead>
                          <TableHead>Baseline</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {locations.slice(0, 40).map((location) => (
                          <TableRow
                            key={location.record_id}
                            className="cursor-pointer"
                            onClick={() => selectRecord(location)}
                          >
                            <TableCell>
                              <div className="font-medium">{location.place_name}</div>
                              <div className="font-mono text-xs text-muted-foreground">{location.record_id}</div>
                            </TableCell>
                            <TableCell>{location.district}</TableCell>
                            <TableCell>{formatUnit(location.rainfall_7d_mm, "mm")}</TableCell>
                            <TableCell>
                              <RiskBadge level={location.baseline_risk_level} label={location.baseline_risk_score.toFixed(4)} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Assessment target</CardTitle>
                  <CardDescription>Use a visible record or click inside Sri Lanka.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex gap-2">
                    <Input
                      value={recordSearch}
                      onChange={(event) => setRecordSearch(event.target.value)}
                      placeholder="Record ID"
                    />
                    <Button type="button" variant="outline" onClick={handleSearchRecord}>
                      <Search data-icon="inline-start" />
                      Load
                    </Button>
                  </div>

                  {activeLocation ? (
                    <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
                      <InfoLine label="Place" value={activeLocation.place_name} />
                      <InfoLine label="District" value={activeLocation.district} />
                      <InfoLine
                        label="Coordinates"
                        value={`${activeLocation.latitude.toFixed(4)}, ${activeLocation.longitude.toFixed(4)}`}
                      />
                      <InfoLine
                        label="Source"
                        value={target?.type === "custom" ? target.context.context_source : activeLocation.data_provider}
                      />
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      Select a monitored place or click on the map.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Scenario assumptions</CardTitle>
                  <CardDescription>Editable inputs for controlled what-if scoring.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {FIELD_CONFIG.map((field) => (
                      <div key={field.key} className="flex flex-col gap-1.5">
                        <Label htmlFor={field.key}>{field.label}</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id={field.key}
                            type="number"
                            step={field.step}
                            value={overrides[field.key] ?? ""}
                            onChange={(event) =>
                              setOverrides((current) => ({
                                ...current,
                                [field.key]: Number(event.target.value),
                              }))
                            }
                          />
                          <span className="w-12 text-xs text-muted-foreground">{field.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={handleSimulate} disabled={!target || simulating}>
                      {simulating ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <SlidersHorizontal data-icon="inline-start" />}
                      Run simulation
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (target?.type === "record") setOverrides(overridesFromLocation(target.location))
                        if (target?.type === "custom") setOverrides(target.context.context)
                        setScenarioResult(null)
                      }}
                      disabled={!target}
                    >
                      <RotateCcw data-icon="inline-start" />
                      Reset
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleExportReport}
                      disabled={!scenarioResult || exporting}
                    >
                      {exporting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Download data-icon="inline-start" />}
                      Export PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Scenario result</CardTitle>
                  <CardDescription>Score, drivers, and action from the current assumptions.</CardDescription>
                </CardHeader>
                <CardContent>
                  {scenarioResult ? (
                    <div className="flex flex-col gap-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Metric label="Baseline" value={scenarioResult.baseline_risk_score.toFixed(4)} level={scenarioResult.baseline_risk_level} />
                        <Metric label="Scenario" value={scenarioResult.scenario_risk_score.toFixed(4)} level={scenarioResult.scenario_risk_level} />
                        <Metric label="Delta" value={formatDelta(scenarioResult.score_delta)} />
                      </div>
                      <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
                        <InfoLine label="Risk level delta" value={scenarioResult.risk_level_delta} />
                        <InfoLine label="Priority" value={scenarioResult.operational_priority} />
                        <InfoLine label="Model" value={scenarioResult.model_version} />
                      </div>
                      <DriverChips drivers={scenarioResult.risk_drivers} />
                      <div className="rounded-lg border border-border p-3 text-sm leading-6 text-muted-foreground">
                        {scenarioResult.recommended_action}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      Run a simulation to compare baseline and scenario risk.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function BoundaryLayer({ boundary }: { boundary: Feature<Polygon> }) {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!map || !isLoaded) return
    const mapInstance = map
    const sourceId = "scenario-boundary"
    const fillId = "scenario-boundary-fill"
    const lineId = "scenario-boundary-line"

    if (!mapInstance.getSource(sourceId)) {
      mapInstance.addSource(sourceId, { type: "geojson", data: boundary })
      mapInstance.addLayer({
        id: fillId,
        type: "fill",
        source: sourceId,
        paint: { "fill-color": "#06b6d4", "fill-opacity": 0.06 },
      })
      mapInstance.addLayer({
        id: lineId,
        type: "line",
        source: sourceId,
        paint: { "line-color": "#67e8f9", "line-width": 1.5, "line-opacity": 0.75 },
      })
      return () => {
        try {
          if (mapInstance.getLayer(lineId)) mapInstance.removeLayer(lineId)
          if (mapInstance.getLayer(fillId)) mapInstance.removeLayer(fillId)
          if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId)
        } catch {
          // MapLibre can dispose the style before React runs child cleanup.
        }
      }
    }

    const source = mapInstance.getSource(sourceId) as
      | { setData: (data: Feature<Polygon>) => void }
      | undefined
    source?.setData(boundary)
  }, [boundary, isLoaded, map])

  return null
}

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (latitude: number, longitude: number) => void
}) {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!map || !isLoaded) return
    const handler = (event: { lngLat: { lat: number; lng: number } }) => {
      void onMapClick(event.lngLat.lat, event.lngLat.lng)
    }
    map.on("click", handler)
    return () => {
      map.off("click", handler)
    }
  }, [isLoaded, map, onMapClick])

  return null
}

function Metric({
  label,
  value,
  level,
}: {
  label: string
  value: string
  level?: "Low" | "Medium" | "High"
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold">{value}</div>
      {level ? <div className="mt-2"><RiskBadge level={level} /></div> : null}
    </div>
  )
}

function overridesFromLocation(location: LocationRow): ScenarioOverrides {
  return {
    rainfall_7d_mm: location.rainfall_7d_mm ?? 0,
    monthly_rainfall_mm: location.monthly_rainfall_mm ?? 0,
    elevation_m: location.elevation_m ?? 0,
    distance_to_river_m: location.distance_to_river_m ?? 0,
    nearest_evac_km: location.nearest_evac_km ?? 0,
    population_density_per_km2: location.population_density_per_km2 ?? 0,
    historical_flood_count: location.historical_flood_count ?? 0,
    infrastructure_score: location.infrastructure_score ?? 0,
  }
}

function contextToLocation(context: ScenarioContext): LocationRow {
  return {
    record_id: "SCENARIO-CUSTOM",
    district: context.district,
    place_name: context.place_name,
    latitude: context.latitude,
    longitude: context.longitude,
    raw_latitude: context.latitude,
    raw_longitude: context.longitude,
    map_latitude: context.latitude,
    map_longitude: context.longitude,
    coordinate_source: "custom_validated_point",
    asset_type: "Custom scenario point",
    data_provider: context.context_source,
    baseline_risk_score: 0,
    baseline_risk_level: "Low",
    operational_priority: "Routine",
    risk_drivers: [],
    recommended_action: "Run simulation to generate an action recommendation.",
    ...context.context,
  }
}

function formatDelta(value: number) {
  const sign = value > 0 ? "+" : ""
  return `${sign}${formatCompact(value)}`
}
