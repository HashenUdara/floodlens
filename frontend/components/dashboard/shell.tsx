import { ReactNode } from "react"
import {
  Activity,
  BarChart3,
  BookOpenText,
  BrainCircuit,
  Building2,
  ListChecks,
  MapPinned,
  Menu,
  Play,
  Waves,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ActiveView, ApiState } from "@/components/dashboard/types"
import { InfoLine } from "@/components/dashboard/shared"

export const NAV_ITEMS: Array<{
  value: ActiveView
  label: string
  icon: ReactNode
}> = [
  { value: "overview", label: "Operations Brief", icon: <Activity /> },
  { value: "explorer", label: "Risk Explorer", icon: <MapPinned /> },
  { value: "districts", label: "District Command", icon: <Building2 /> },
  { value: "priority", label: "Priority Queue", icon: <ListChecks /> },
  { value: "prediction", label: "Model Serving", icon: <Play /> },
  { value: "monitoring", label: "Model Operations", icon: <BarChart3 /> },
  { value: "knowledge", label: "Knowledge Library", icon: <BookOpenText /> },
  { value: "copilot", label: "Intelligent Copilot", icon: <BrainCircuit /> },
]

export function DashboardSidebar({
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
          {NAV_ITEMS.map((item) => (
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

export function MobileHeader({
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
            <SheetDescription>Flood-risk operations and model intelligence.</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <div className="space-y-1">
              {NAV_ITEMS.map((item) => (
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
