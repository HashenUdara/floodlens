import { ReactNode } from "react"
import {
  Activity,
  BarChart3,
  BookOpenText,
  Bot,
  BrainCircuit,
  FileText,
  FolderOpen,
  Gauge,
  ListChecks,
  MapPinned,
  Menu,
  ServerCog,
  SlidersHorizontal,
  TerminalSquare,
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
import { ActiveView, ApiState, AppMode } from "@/components/dashboard/types"
import { InfoLine } from "@/components/dashboard/shared"

type NavItem = {
  value: ActiveView
  label: string
  icon: ReactNode
}

export const COMMAND_NAV_ITEMS: NavItem[] = [
  { value: "briefing", label: "Briefing", icon: <Activity /> },
  { value: "risk-map", label: "Risk Map", icon: <MapPinned /> },
  { value: "priority-list", label: "Priority List", icon: <ListChecks /> },
  { value: "scenario", label: "Scenario Lab", icon: <SlidersHorizontal /> },
  { value: "reports", label: "Action Reports", icon: <FileText /> },
  { value: "response-documents", label: "Response Documents", icon: <FolderOpen /> },
  { value: "copilot", label: "Copilot", icon: <Bot /> },
]

export const OPS_NAV_ITEMS: NavItem[] = [
  { value: "model-overview", label: "Model Overview", icon: <Gauge /> },
  { value: "serving", label: "Serving", icon: <ServerCog /> },
  { value: "monitoring", label: "Monitoring", icon: <BarChart3 /> },
  { value: "feedback-drift", label: "Feedback & Drift", icon: <BrainCircuit /> },
  { value: "knowledge-ops", label: "Knowledge Ops", icon: <BookOpenText /> },
  { value: "developer-tools", label: "Developer Tools", icon: <TerminalSquare /> },
]

const MODE_COPY: Record<AppMode, { label: string; subtitle: string }> = {
  command: {
    label: "Command Center",
    subtitle: "Flood-risk decision support",
  },
  ops: {
    label: "Model Ops",
    subtitle: "Model and system operations",
  },
}

export function DashboardSidebar({
  activeView,
  appMode,
  apiState,
  modelVersion,
  totalPredictions,
  onChange,
  onModeChange,
}: {
  activeView: ActiveView
  appMode: AppMode
  apiState: ApiState
  modelVersion?: string
  totalPredictions: number
  onChange: (view: ActiveView) => void
  onModeChange: (mode: AppMode) => void
}) {
  const navItems = appMode === "command" ? COMMAND_NAV_ITEMS : OPS_NAV_ITEMS

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-border bg-card/30 lg:block">
      <div className="flex h-full flex-col p-4">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex size-9 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
            <Waves className="size-5" />
          </div>
          <div>
            <div className="font-semibold tracking-tight">FloodLens</div>
            <div className="text-xs text-muted-foreground">
              {MODE_COPY[appMode].subtitle}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 rounded-lg border border-border bg-muted/20 p-1">
          {(["command", "ops"] as AppMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onModeChange(mode)}
              className={cn(
                "h-8 rounded-md px-2 text-xs font-medium transition-colors",
                appMode === mode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {MODE_COPY[mode].label}
            </button>
          ))}
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

        <div className="mt-auto rounded-lg border border-border p-3">
          {appMode === "command" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Workspace</span>
                <Badge variant="outline">Decision support</Badge>
              </div>
              <InfoLine label="Focus" value="risk, priority, action" />
              <InfoLine label="Mode" value="business" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">API</span>
                <Badge variant={apiState === "online" ? "secondary" : "destructive"}>
                  {apiState}
                </Badge>
              </div>
              <InfoLine label="Model" value={modelVersion ?? "pending"} />
              <InfoLine label="Events" value={totalPredictions.toLocaleString()} />
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

export function MobileHeader({
  activeView,
  appMode,
  apiState,
  modelVersion,
  totalPredictions,
  onChange,
  onModeChange,
}: {
  activeView: ActiveView
  appMode: AppMode
  apiState: ApiState
  modelVersion?: string
  totalPredictions: number
  onChange: (view: ActiveView) => void
  onModeChange: (mode: AppMode) => void
}) {
  const navItems = appMode === "command" ? COMMAND_NAV_ITEMS : OPS_NAV_ITEMS

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
      <div className="flex items-center gap-2">
        <Waves className="size-5 text-cyan-300" />
        <div>
          <span className="font-semibold">FloodLens</span>
          <div className="text-xs text-muted-foreground">{MODE_COPY[appMode].label}</div>
        </div>
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
            <SheetDescription>{MODE_COPY[appMode].subtitle}</SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <div className="mb-4 grid grid-cols-2 rounded-lg border border-border bg-muted/20 p-1">
              {(["command", "ops"] as AppMode[]).map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  variant={appMode === mode ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => onModeChange(mode)}
                >
                  {MODE_COPY[mode].label}
                </Button>
              ))}
            </div>
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
            {appMode === "command" ? (
              <div className="space-y-2 text-sm">
                <InfoLine label="Workspace" value="decision support" />
                <InfoLine label="Focus" value="risk, priority, action" />
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <InfoLine label="API" value={apiState} />
                <InfoLine label="Model" value={modelVersion ?? "pending"} />
                <InfoLine label="Events" value={totalPredictions.toLocaleString()} />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
