import { MapPinned } from "lucide-react"

import { EmergencyPriorityLocation } from "@/lib/api"
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
import { CompactDriverList, RiskBadge } from "@/components/dashboard/shared"

export function BusinessPriorityList({
  district,
  districts,
  priorityLocations,
  loading,
  onDistrictChange,
  onOpenLocation,
}: {
  district: string
  districts: string[]
  priorityLocations: EmergencyPriorityLocation[]
  loading: boolean
  onDistrictChange: (district: string) => void
  onOpenLocation: (recordId: string, district?: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Priority List</CardTitle>
        <CardDescription>
          Ranked places needing attention, with reasons and recommended action.
        </CardDescription>
        <CardAction>
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
        </CardAction>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[720px] rounded-lg border border-border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead className="min-w-56">Place</TableHead>
                <TableHead className="w-28">Risk</TableHead>
                <TableHead className="w-28">Priority</TableHead>
                <TableHead className="min-w-56">Reason</TableHead>
                <TableHead className="min-w-80">Recommended action</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-7 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : priorityLocations.length ? (
                priorityLocations.map((location) => (
                  <TableRow key={location.record_id}>
                    <TableCell className="font-mono text-xs">#{location.rank}</TableCell>
                    <TableCell>
                      <div className="font-medium">{location.place_name}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {location.district} / {location.record_id}
                      </div>
                    </TableCell>
                    <TableCell>
                      <RiskBadge level={location.baseline_risk_level} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{location.operational_priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <CompactDriverList drivers={location.priority_reasons} />
                    </TableCell>
                    <TableCell className="max-w-md text-sm text-muted-foreground">
                      {location.recommended_action}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onOpenLocation(location.record_id, location.district)
                        }
                      >
                        <MapPinned /> Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No priority places for this scope.
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
