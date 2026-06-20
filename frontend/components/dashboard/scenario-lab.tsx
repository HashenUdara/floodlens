"use client"

import { useEffect, useMemo, useState } from "react"
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
  step: number
  min: number
  max: number
  normal: number
  lowLabel: string
  highLabel: string
  help: string
}> = [
  {
    key: "rainfall_7d_mm",
    label: "Rain expected this week",
    unit: "mm",
    step: 5,
    min: 0,
    max: 300,
    normal: 50,
    lowLabel: "light",
    highLabel: "extreme",
    help: "Use this when planners expect heavier rainfall than usual.",
  },
  {
    key: "monthly_rainfall_mm",
    label: "Wet month pressure",
    unit: "mm",
    step: 10,
    min: 0,
    max: 800,
    normal: 150,
    lowLabel: "dry",
    highLabel: "very wet",
    help: "Represents accumulated pressure before the next event.",
  },
  {
    key: "elevation_m",
    label: "Ground height",
    unit: "m",
    step: 5,
    min: 0,
    max: 2500,
    normal: 60,
    lowLabel: "low",
    highLabel: "high",
    help: "Lower places usually need earlier attention.",
  },
  {
    key: "distance_to_river_m",
    label: "Distance from river",
    unit: "m",
    step: 100,
    min: 0,
    max: 10000,
    normal: 2500,
    lowLabel: "near",
    highLabel: "far",
    help: "Closer locations can face faster river or drainage impact.",
  },
  {
    key: "nearest_evac_km",
    label: "Access to safe point",
    unit: "km",
    step: 0.5,
    min: 0,
    max: 50,
    normal: 5,
    lowLabel: "near",
    highLabel: "far",
    help: "Longer access distance raises operational priority.",
  },
  {
    key: "population_density_per_km2",
    label: "People exposed nearby",
    unit: "/km2",
    step: 50,
    min: 0,
    max: 5000,
    normal: 600,
    lowLabel: "low",
    highLabel: "dense",
    help: "Higher exposure can change who needs to review the plan.",
  },
  {
    key: "historical_flood_count",
    label: "Known past flood events",
    unit: "count",
    step: 1,
    min: 0,
    max: 20,
    normal: 1,
    lowLabel: "rare",
    highLabel: "repeated",
    help: "Use local memory or field records when available.",
  },
  {
    key: "infrastructure_score",
    label: "Drainage and road condition",
    unit: "/100",
    step: 5,
    min: 0,
    max: 100,
    normal: 60,
    lowLabel: "weak",
    highLabel: "strong",
    help: "Lower scores mean weaker drainage, access, or protection.",
  },
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
  const [targetSearch, setTargetSearch] = useState(
    selectedLocation ? `${selectedLocation.place_name}, ${selectedLocation.district}` : ""
  )
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
  const targetMatches = useMemo(
    () => findLocationMatches(locations, targetSearch),
    [locations, targetSearch]
  )

  function selectRecord(location: LocationRow) {
    setTarget({ type: "record", location })
    setTargetSearch(`${location.place_name}, ${location.district}`)
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
      setTargetSearch(`${context.place_name}, ${context.district}`)
      setOverrides(context.context)
      setScenarioResult(null)
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Scenario context request failed")
    } finally {
      setLoadingContext(false)
    }
  }

  function handleSearchTarget() {
    const match = targetMatches[0]
    if (!match) {
      setMessage("No visible monitored place matched that area. Try a district, town, place name, or click the map.")
      return
    }
    selectRecord(match)
  }

  function applyPreset(preset: "heavy-rain" | "access-delay" | "river-pressure" | "shelter-capacity") {
    setOverrides((current) => {
      if (preset === "heavy-rain") {
        return {
          ...current,
          rainfall_7d_mm: Math.max(current.rainfall_7d_mm ?? 0, 180),
          monthly_rainfall_mm: Math.max(current.monthly_rainfall_mm ?? 0, 420),
        }
      }
      if (preset === "access-delay") {
        return {
          ...current,
          nearest_evac_km: Math.max(current.nearest_evac_km ?? 0, 25),
          infrastructure_score: Math.min(current.infrastructure_score ?? 45, 35),
        }
      }
      if (preset === "river-pressure") {
        return {
          ...current,
          distance_to_river_m: Math.min(current.distance_to_river_m ?? 800, 300),
          rainfall_7d_mm: Math.max(current.rainfall_7d_mm ?? 0, 140),
        }
      }
      return {
        ...current,
        population_density_per_km2: Math.max(current.population_density_per_km2 ?? 0, 1500),
        nearest_evac_km: Math.max(current.nearest_evac_km ?? 0, 18),
      }
    })
    setScenarioResult(null)
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
            <CardTitle>What-if Planning</CardTitle>
            <CardDescription>
              Test likely response conditions before teams move, then export a handover report.
            </CardDescription>
          </div>
          <CardAction className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1.5">
              <SlidersHorizontal className="size-3" />
              Scenario planning
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
                        {location.place_name}, {location.district}
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
                              <div className="text-xs text-muted-foreground">{location.operational_priority} priority</div>
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
                  <CardTitle>Choose place or area</CardTitle>
                  <CardDescription>Search by place or district, select from the list, or click inside Sri Lanka.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex gap-2">
                    <Input
                      value={targetSearch}
                      onChange={(event) => setTargetSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleSearchTarget()
                      }}
                      placeholder="Search place or district, e.g. Colombo"
                    />
                    <Button type="button" variant="outline" onClick={handleSearchTarget}>
                      <Search data-icon="inline-start" />
                      Find
                    </Button>
                  </div>
                  {targetSearch.trim() ? (
                    <div className="rounded-lg border border-border p-2">
                      <div className="mb-2 text-xs text-muted-foreground">
                        {targetMatches.length
                          ? `${targetMatches.length} visible match${targetMatches.length === 1 ? "" : "es"}`
                          : "No visible matches yet"}
                      </div>
                      <div className="flex flex-col gap-1">
                        {targetMatches.slice(0, 4).map((location) => (
                          <button
                            key={location.record_id}
                            type="button"
                            className="flex items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => selectRecord(location)}
                          >
                            <span>
                              <span className="font-medium">{location.place_name}</span>
                              <span className="text-muted-foreground">, {location.district}</span>
                            </span>
                            <RiskBadge level={location.baseline_risk_level} label={location.operational_priority} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {activeLocation ? (
                    <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
                      <InfoLine label="Place" value={activeLocation.place_name} />
                      <InfoLine label="District" value={activeLocation.district} />
                      <InfoLine
                        label="Coordinates"
                        value={`${activeLocation.latitude.toFixed(4)}, ${activeLocation.longitude.toFixed(4)}`}
                      />
                      <InfoLine label="Planning target" value={target?.type === "custom" ? "Custom map point" : activeLocation.asset_type} />
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
                  <CardTitle>Scenario presets</CardTitle>
                  <CardDescription>Choose a planning condition or open advanced assumptions.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button type="button" variant="outline" onClick={() => applyPreset("heavy-rain")}>
                      Heavy rainfall next 24h
                    </Button>
                    <Button type="button" variant="outline" onClick={() => applyPreset("access-delay")}>
                      Access route delayed
                    </Button>
                    <Button type="button" variant="outline" onClick={() => applyPreset("river-pressure")}>
                      River level pressure
                    </Button>
                    <Button type="button" variant="outline" onClick={() => applyPreset("shelter-capacity")}>
                      Shelter capacity concern
                    </Button>
                  </div>

                  <details className="rounded-lg border border-border p-3">
                    <summary className="cursor-pointer text-sm text-muted-foreground">
                      Advanced assumptions
                    </summary>
                    <div className="mt-3 flex flex-col gap-3">
                      {FIELD_CONFIG.map((field) => (
                        <AssumptionControl
                          key={field.key}
                          field={field}
                          value={overrides[field.key]}
                          onChange={(value) =>
                            setOverrides((current) => ({
                              ...current,
                              [field.key]: value,
                            }))
                          }
                        />
                      ))}
                    </div>
                  </details>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={handleSimulate} disabled={!target || simulating}>
                      {simulating ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <SlidersHorizontal data-icon="inline-start" />}
                      Run scenario
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
                      Export action report
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Planning result</CardTitle>
                  <CardDescription>Risk change, action change, and handover path.</CardDescription>
                </CardHeader>
                <CardContent>
                  {scenarioResult ? (
                    <div className="flex flex-col gap-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Metric label="Baseline risk" value={scenarioResult.baseline_risk_score.toFixed(4)} level={scenarioResult.baseline_risk_level} />
                        <Metric label="Scenario risk" value={scenarioResult.scenario_risk_score.toFixed(4)} level={scenarioResult.scenario_risk_level} />
                        <Metric label="Risk change" value={formatDelta(scenarioResult.score_delta)} />
                      </div>
                      <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
                        <InfoLine label="Action change" value={scenarioResult.risk_level_delta} />
                        <InfoLine label="Who should review" value="district response desk" />
                        <InfoLine label="Priority" value={scenarioResult.operational_priority} />
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

function AssumptionControl({
  field,
  value,
  onChange,
}: {
  field: (typeof FIELD_CONFIG)[number]
  value: number | undefined
  onChange: (value: number) => void
}) {
  const safeValue = clampNumber(value ?? field.normal, field.min, field.max)
  const percentage =
    field.max === field.min ? 0 : ((safeValue - field.min) / (field.max - field.min)) * 100

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label htmlFor={field.key}>{field.label}</Label>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{field.help}</p>
        </div>
        <div className="min-w-24 text-right">
          <div className="font-mono text-sm font-semibold">
            {formatAssumptionValue(safeValue, field.unit)}
          </div>
          <div className="text-xs text-muted-foreground">current assumption</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="w-14 text-xs text-muted-foreground">{field.lowLabel}</span>
        <input
          id={field.key}
          type="range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={safeValue}
          onChange={(event) => onChange(Number(event.target.value))}
          className="scenario-assumption-range h-3 flex-1 cursor-pointer appearance-none rounded-full"
          style={{
            background: `linear-gradient(to right, var(--primary) ${percentage}%, var(--muted) ${percentage}%)`,
          }}
        />
        <span className="w-16 text-right text-xs text-muted-foreground">{field.highLabel}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(field.normal)}>
          Use normal
        </Button>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={field.min}
            max={field.max}
            step={field.step}
            value={Number.isFinite(safeValue) ? safeValue : ""}
            onChange={(event) =>
              onChange(clampNumber(Number(event.target.value), field.min, field.max))
            }
            className="w-28"
            aria-label={`${field.label} exact value`}
          />
          <span className="w-12 text-xs text-muted-foreground">{field.unit}</span>
        </div>
      </div>
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

function findLocationMatches(locations: LocationRow[], query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []
  return locations
    .filter((location) => {
      const haystack = [
        location.place_name,
        location.district,
        location.asset_type,
        location.record_id,
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(normalized)
    })
    .sort((a, b) => {
      const aExactDistrict = a.district.toLowerCase() === normalized ? 1 : 0
      const bExactDistrict = b.district.toLowerCase() === normalized ? 1 : 0
      if (aExactDistrict !== bExactDistrict) return bExactDistrict - aExactDistrict
      return b.baseline_risk_score - a.baseline_risk_score
    })
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function formatAssumptionValue(value: number, unit: string) {
  const display = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)
  return `${display}${unit.startsWith("/") ? unit : ` ${unit}`}`
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
