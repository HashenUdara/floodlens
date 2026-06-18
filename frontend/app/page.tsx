"use client"

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react"
import type { FeatureCollection, Point } from "geojson"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  DatabaseZap,
  Filter,
  Gauge,
  Layers3,
  Loader2,
  LocateFixed,
  MapPinned,
  Menu,
  Play,
  RadioTower,
  Search,
  ShieldCheck,
  Table2,
  Waves,
} from "lucide-react"

import {
  getDistricts,
  getHealth,
  getLocationRecord,
  getLocations,
  getModelInfo,
  getMonitoringSummary,
  LocationRow,
  ModelInfo,
  MonitoringSummary,
  predictFloodRisk,
  PredictionResult,
} from "@/lib/api"
import { sampleRecord } from "@/lib/sample-record"
import { cn } from "@/lib/utils"
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type ApiState = "checking" | "online" | "offline"
type ActiveView = "overview" | "explorer" | "prediction" | "monitoring"

type LocationFeatureProperties = {
  record_id: string
  district: string
  place_name: string
}

const initialPayload = JSON.stringify(sampleRecord, null, 2)
const ALL_DISTRICTS = "__all__"

const navItems: Array<{
  value: ActiveView
  label: string
  icon: ReactNode
}> = [
  { value: "overview", label: "Overview", icon: <Activity /> },
  { value: "explorer", label: "Risk Explorer", icon: <MapPinned /> },
  { value: "prediction", label: "Prediction", icon: <Play /> },
  { value: "monitoring", label: "Monitoring", icon: <BarChart3 /> },
]

export default function Home() {
  const [activeView, setActiveView] = useState<ActiveView>("explorer")
  const [apiState, setApiState] = useState<ApiState>("checking")
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null)
  const [monitoring, setMonitoring] = useState<MonitoringSummary | null>(null)
  const [districts, setDistricts] = useState<string[]>([])
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [district, setDistrict] = useState(ALL_DISTRICTS)
  const [search, setSearch] = useState("")
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [payload, setPayload] = useState(initialPayload)
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [locationPredictions, setLocationPredictions] = useState<
    Record<string, PredictionResult>
  >({})
  const [loadingDashboard, setLoadingDashboard] = useState(true)
  const [loadingLocations, setLoadingLocations] = useState(true)
  const [predicting, setPredicting] = useState(false)
  const [predictingRecordId, setPredictingRecordId] = useState<string | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)

  async function refreshMonitoring() {
    setMonitoring(await getMonitoringSummary())
  }

  useEffect(() => {
    let ignore = false

    async function loadDashboard() {
      try {
        const [health, model, summary, districtList] = await Promise.all([
          getHealth(),
          getModelInfo(),
          getMonitoringSummary(),
          getDistricts(),
        ])
        if (ignore) return
        setApiState(health.model_loaded ? "online" : "offline")
        setModelInfo(model)
        setMonitoring(summary)
        setDistricts(districtList)
      } catch (err: unknown) {
        if (ignore) return
        setApiState("offline")
        setError(err instanceof Error ? err.message : "Backend is unavailable")
      } finally {
        if (!ignore) setLoadingDashboard(false)
      }
    }

    void loadDashboard()

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false

    async function loadLocations() {
      setLoadingLocations(true)
      try {
        const rows = await getLocations({
          district: district === ALL_DISTRICTS ? undefined : district,
          search,
          limit: 250,
        })
        if (ignore) return
        setLocations(rows)
        setSelectedRecordId((current) =>
          current && rows.some((row) => row.record_id === current)
            ? current
            : rows[0]?.record_id ?? null
        )
      } catch (err: unknown) {
        if (ignore) return
        setError(err instanceof Error ? err.message : "Location request failed")
      } finally {
        if (!ignore) setLoadingLocations(false)
      }
    }

    const timer = window.setTimeout(() => {
      void loadLocations()
    }, 180)

    return () => {
      ignore = true
      window.clearTimeout(timer)
    }
  }, [district, search])

  const selectedLocation = useMemo(
    () => locations.find((row) => row.record_id === selectedRecordId) ?? null,
    [locations, selectedRecordId]
  )

  const riskTotal = useMemo(
    () =>
      (monitoring?.low_risk_count ?? 0) +
      (monitoring?.medium_risk_count ?? 0) +
      (monitoring?.high_risk_count ?? 0),
    [monitoring]
  )

  async function handleJsonPredict(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPredicting(true)
    setError(null)

    try {
      const record = JSON.parse(payload) as Record<string, unknown>
      const result = await predictFloodRisk(record)
      setPrediction(result)
      if (result.record_id) {
        setLocationPredictions((current) => ({
          ...current,
          [result.record_id as string]: result,
        }))
      }
      await refreshMonitoring()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Prediction request failed")
    } finally {
      setPredicting(false)
    }
  }

  async function handlePredictLocation(recordId: string) {
    setPredictingRecordId(recordId)
    setError(null)

    try {
      const record = await getLocationRecord(recordId)
      const result = await predictFloodRisk(record)
      setPrediction(result)
      setLocationPredictions((current) => ({ ...current, [recordId]: result }))
      setSelectedRecordId(recordId)
      await refreshMonitoring()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Prediction request failed")
    } finally {
      setPredictingRecordId(null)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <DashboardSidebar
          activeView={activeView}
          apiState={apiState}
          modelVersion={modelInfo?.model_version}
          totalPredictions={monitoring?.total_predictions ?? 0}
          onChange={setActiveView}
        />

        <section className="flex min-w-0 flex-1 flex-col">
          <MobileHeader
            activeView={activeView}
            apiState={apiState}
            modelVersion={modelInfo?.model_version}
            totalPredictions={monitoring?.total_predictions ?? 0}
            onChange={setActiveView}
          />

          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
            <header className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-cyan-400/30 text-cyan-300"
                  >
                    <Waves className="size-3" />
                    FloodLens
                  </Badge>
                  <Badge
                    variant={apiState === "online" ? "secondary" : "destructive"}
                    className="gap-1.5"
                  >
                    <RadioTower className="size-3" />
                    API {apiState}
                  </Badge>
                  {modelInfo ? (
                    <Badge variant="outline" className="font-mono">
                      {modelInfo.model_version}
                    </Badge>
                  ) : null}
                </div>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Flood Risk Intelligence Dashboard
                </h1>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  Business-ready flood intelligence for monitored communities,
                  assets, and response planning across Sri Lanka.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm sm:flex">
                <StatusPill label="Monitored places" value={locations.length.toString()} />
                <StatusPill
                  label="Logged events"
                  value={`${monitoring?.total_predictions ?? 0}`}
                />
              </div>
            </header>

            {error ? (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertTitle>Request failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <MetricGrid
              modelInfo={modelInfo}
              monitoring={monitoring}
              loading={loadingDashboard}
            />

            <Tabs
              value={activeView}
              onValueChange={(value) => setActiveView(value as ActiveView)}
              className="gap-4"
            >
              <TabsList className="hidden w-fit lg:flex">
                {navItems.map((item) => (
                  <TabsTrigger key={item.value} value={item.value}>
                    <span className="[&_svg]:size-4">{item.icon}</span>
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview">
                <OverviewPanel
                  apiState={apiState}
                  modelInfo={modelInfo}
                  monitoring={monitoring}
                  riskTotal={riskTotal}
                  loading={loadingDashboard}
                />
              </TabsContent>

              <TabsContent value="explorer">
                <RiskExplorer
                  districts={districts}
                  district={district}
                  search={search}
                  locations={locations}
                  selectedLocation={selectedLocation}
                  predictions={locationPredictions}
                  loading={loadingLocations}
                  predictingRecordId={predictingRecordId}
                  onDistrictChange={setDistrict}
                  onSearchChange={setSearch}
                  onSelectLocation={setSelectedRecordId}
                  onPredictLocation={handlePredictLocation}
                />
              </TabsContent>

              <TabsContent value="prediction">
                <PredictionPanel
                  payload={payload}
                  prediction={prediction}
                  predicting={predicting}
                  onPayloadChange={setPayload}
                  onResetPayload={() => setPayload(initialPayload)}
                  onPredict={handleJsonPredict}
                />
              </TabsContent>

              <TabsContent value="monitoring">
                <MonitoringPanel monitoring={monitoring} />
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </div>
    </main>
  )
}

function DashboardSidebar({
  activeView,
  apiState,
  modelVersion,
  totalPredictions,
  onChange,
}: {
  activeView: ActiveView
  apiState: ApiState
  modelVersion?: string
  totalPredictions: number
  onChange: (view: ActiveView) => void
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-border bg-card/30 lg:block">
      <div className="flex h-full flex-col p-4">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex size-9 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
            <Waves className="size-5" />
          </div>
          <div>
            <div className="font-semibold tracking-tight">FloodLens</div>
            <div className="text-xs text-muted-foreground">MLOps command center</div>
          </div>
        </div>

        <Separator className="my-4" />

        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={cn(
                "flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-sm transition-colors",
                activeView === item.value
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <span className="[&_svg]:size-4">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">API</span>
            <Badge variant={apiState === "online" ? "secondary" : "destructive"}>
              {apiState}
            </Badge>
          </div>
          <InfoLine label="Model" value={modelVersion ?? "pending"} />
          <InfoLine label="Events" value={totalPredictions.toLocaleString()} />
        </div>
      </div>
    </aside>
  )
}

function MobileHeader({
  activeView,
  apiState,
  modelVersion,
  totalPredictions,
  onChange,
}: {
  activeView: ActiveView
  apiState: ApiState
  modelVersion?: string
  totalPredictions: number
  onChange: (view: ActiveView) => void
}) {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
      <div className="flex items-center gap-2">
        <Waves className="size-5 text-cyan-300" />
        <span className="font-semibold">FloodLens</span>
      </div>
      <Sheet>
        <SheetTrigger
          render={
            <Button variant="outline" size="icon-sm">
              <Menu />
              <span className="sr-only">Open navigation</span>
            </Button>
          }
        />
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle>FloodLens</SheetTitle>
            <SheetDescription>Model serving and risk intelligence.</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <div className="space-y-1">
              {navItems.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  variant={activeView === item.value ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => onChange(item.value)}
                >
                  <span className="[&_svg]:size-4">{item.icon}</span>
                  {item.label}
                </Button>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="space-y-2 text-sm">
              <InfoLine label="API" value={apiState} />
              <InfoLine label="Model" value={modelVersion ?? "pending"} />
              <InfoLine label="Events" value={totalPredictions.toLocaleString()} />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function MetricGrid({
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
        detail="successful API events"
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
        detail="prediction log"
        loading={loading}
      />
    </section>
  )
}

function OverviewPanel({
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
          <CardTitle>Model serving status</CardTitle>
          <CardDescription>Active artifact metadata from the FastAPI backend.</CardDescription>
          <CardAction>
            <Badge variant="secondary">{apiState}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {loading || !modelInfo ? (
            <InfoSkeleton />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Version" value={modelInfo.model_version} />
              <InfoRow label="Trained" value={formatDate(modelInfo.trained_at)} />
              <InfoRow label="Rows" value={modelInfo.metrics.n_train.toLocaleString()} />
              <InfoRow label="Features" value={modelInfo.feature_count.toString()} />
              <InfoRow label="Test std" value={formatNumber(modelInfo.metrics.test_std, 4)} />
              <InfoRow label="Training time" value={`${modelInfo.metrics.training_time_s}s`} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk distribution</CardTitle>
          <CardDescription>Counts from logged prediction events.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

function RiskExplorer({
  districts,
  district,
  search,
  locations,
  selectedLocation,
  predictions,
  loading,
  predictingRecordId,
  onDistrictChange,
  onSearchChange,
  onSelectLocation,
  onPredictLocation,
}: {
  districts: string[]
  district: string
  search: string
  locations: LocationRow[]
  selectedLocation: LocationRow | null
  predictions: Record<string, PredictionResult>
  loading: boolean
  predictingRecordId: string | null
  onDistrictChange: (district: string) => void
  onSearchChange: (search: string) => void
  onSelectLocation: (recordId: string) => void
  onPredictLocation: (recordId: string) => void
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
    <div className="grid gap-4 2xl:grid-cols-[1fr_420px]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="gap-3">
            <div>
              <CardTitle>Monitored places explorer</CardTitle>
              <CardDescription>
                Explore operational places under watch, inspect risk drivers,
                and run selected assets through the model API.
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
              <AlertTitle>Business layer active</AlertTitle>
              <AlertDescription>
                The current CSV is treated as a seed provider. The map uses
                corrected district presentation coordinates, while risk drivers,
                priority, and recommendations are computed before any model call.
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
                onPredictLocation={onPredictLocation}
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
  selectedPrediction: PredictionResult | null
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
  onPredictLocation,
}: {
  location: LocationRow | null
  prediction: PredictionResult | null
  predicting: boolean
  onPredictLocation: (recordId: string) => void
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
              {prediction ? "Model-assisted score" : "Baseline signal score"}
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {prediction?.model_version ?? "provider baseline"}
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
        Predict selected
      </Button>
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
  predictions: Record<string, PredictionResult>
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
          Prioritize monitored places using baseline signals, then run the model
          where a decision needs more confidence.
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
                <TableHead>Baseline</TableHead>
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
                        {prediction ? (
                          <RiskBadge level={prediction.risk_level} />
                        ) : (
                          <RiskBadge level={location.baseline_risk_level} />
                        )}
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
                          Predict
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

function PredictionPanel({
  payload,
  prediction,
  predicting,
  onPayloadChange,
  onResetPayload,
  onPredict,
}: {
  payload: string
  prediction: PredictionResult | null
  predicting: boolean
  onPayloadChange: (payload: string) => void
  onResetPayload: () => void
  onPredict: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.7fr]">
      <Card>
        <CardHeader>
          <CardTitle>Single location prediction</CardTitle>
          <CardDescription>
            Submit a full test-row style record to the deployed model API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onPredict}>
            <div className="space-y-2">
              <Label htmlFor="prediction-payload">Prediction payload</Label>
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
                Run prediction
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
          <CardTitle>Prediction result</CardTitle>
          <CardDescription>Latest response from POST /predict.</CardDescription>
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
                <InfoRow label="Model" value={prediction.model_version} />
                <InfoRow label="Risk level" value={prediction.risk_level} />
                <InfoRow label="Monitoring" value="event logged" />
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
              No prediction submitted in this browser session.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MonitoringPanel({ monitoring }: { monitoring: MonitoringSummary | null }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle>Model versions</CardTitle>
          <CardDescription>Version usage from prediction logs.</CardDescription>
        </CardHeader>
        <CardContent>
          {monitoring && Object.keys(monitoring.model_versions).length > 0 ? (
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top districts by predictions</CardTitle>
          <CardDescription>Operational activity from logged API calls.</CardDescription>
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
    </div>
  )
}

function MetricCard({
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-mono text-sm">{value}</span>
    </div>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-mono text-xs">{value}</span>
    </div>
  )
}

function RiskBar({
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

function RiskBadge({ level }: { level: PredictionResult["risk_level"] }) {
  const className =
    level === "High"
      ? "border-rose-400/30 bg-rose-400/10 text-rose-300"
      : level === "Medium"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
        : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"

  return (
    <Badge variant="outline" className={className}>
      {level}
    </Badge>
  )
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  )
}

function InfoSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-9 rounded-lg" />
      ))}
    </div>
  )
}

function EmptyLine() {
  return (
    <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
      No prediction events logged yet.
    </div>
  )
}

function riskMarkerClass(level?: PredictionResult["risk_level"]) {
  if (level === "High") return "bg-rose-400 ring-rose-400/25"
  if (level === "Medium") return "bg-amber-400 ring-amber-400/25"
  if (level === "Low") return "bg-emerald-400 ring-emerald-400/25"
  return "bg-cyan-300 ring-cyan-300/25"
}

function formatNumber(value: number | undefined, digits: number) {
  return typeof value === "number" ? value.toFixed(digits) : "-"
}

function formatNullable(value: number | null | undefined) {
  return typeof value === "number" ? value.toFixed(6) : "-"
}

function formatCompact(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "-"
}

function formatUnit(value: number | null | undefined, unit: string) {
  return typeof value === "number" ? `${formatCompact(value)} ${unit}` : "-"
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatTime(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
