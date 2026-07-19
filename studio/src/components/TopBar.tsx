"use client"

import { Activity, RefreshCw, Sparkles, GitCompare, Waves } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface TopBarProps {
  environmentLabel: string
  statusLabel: string
  statusVariant: "success" | "secondary" | "destructive"
  metrics: Array<{ label: string; value: string; tone?: string }>
  busy?: boolean
  onSynthesize: () => void
  onCompare: () => void
  onRefresh: () => void
}

export function TopBar({
  environmentLabel,
  statusLabel,
  statusVariant,
  metrics,
  busy = false,
  onSynthesize,
  onCompare,
  onRefresh,
}: TopBarProps) {
  return (
    <div className="h-20 border-b bg-card/40 backdrop-blur-3xl border-white/5 shadow-2xl flex flex-col justify-center px-8 z-30 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-heading text-xl font-bold">Archisynapse Sovereign Core</h1>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mt-1">{environmentLabel}</div>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex items-center gap-2">
              <span className="text-muted-foreground text-[10px] uppercase tracking-widest">{metric.label}</span>
              <span className={`font-bold font-heading ${metric.tone || "text-primary"}`}>{metric.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2">
        <Badge variant={statusVariant} className="h-5 text-[9px]">{statusLabel}</Badge>
        <div className="flex items-center gap-2">
          <Button variant="glow" size="pill" onClick={onSynthesize} disabled={busy}>
            <Sparkles className="h-3.5 w-3.5 mr-2" />
            Synthesize
          </Button>
          <Button variant="outline" size="pill" onClick={onCompare} disabled={busy}>
            <GitCompare className="h-3.5 w-3.5 mr-2" />
            Compare
          </Button>
          <Button variant="default" size="pill" className="bg-emerald-500 hover:bg-emerald-600 text-black border-0" disabled>
            <Waves className="h-3.5 w-3.5 mr-2" />
            {environmentLabel}
          </Button>
          <Button variant="glass" size="pill" onClick={onRefresh} disabled={busy}>
            {busy ? <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Activity className="h-3.5 w-3.5 mr-2" />}
            Refresh
          </Button>
        </div>
      </div>
    </div>
  )
}
