"use client"

import { useState, useEffect } from "react"
import { EvolutionRecord, EvolutionPreset } from "@/ai/flows/agentic-evolution-flow"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { TrendingUp, Shield, Zap, RefreshCw, ArrowUp, ArrowDown } from "lucide-react"

interface ScorecardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentBlueprint?: { avgROI: number; totalRisk: number; healthyCount: number }
}

interface AggregatedMetrics {
  totalEvolutions: number
  totalIssues: number
  totalActions: number
  sumROIDelta: number
  sumRiskDelta: number
  sumDebtDelta: number
  sumHealthDelta: number
  modeBreakdown: Record<string, number>
  records: EvolutionRecord[]
}

const MODE_LABELS: Record<string, string> = {
  auto: "Full Spectrum",
  roi: "ROI Mode",
  security: "Security Mode",
  scale: "Scale Mode",
}

const MODE_ICONS: Record<string, typeof TrendingUp> = {
  auto: RefreshCw,
  roi: TrendingUp,
  security: Shield,
  scale: Zap,
}

const MODE_COLORS: Record<string, string> = {
  auto: "text-accent",
  roi: "text-emerald-400",
  security: "text-orange-400",
  scale: "text-cyan-400",
}

function aggregate(records: EvolutionRecord[]): AggregatedMetrics {
  const withDeltas = records.filter(r => r.delta)
  const modeBreakdown: Record<string, number> = {}
  for (const r of records) {
    modeBreakdown[r.preset] = (modeBreakdown[r.preset] || 0) + 1
  }
  return {
    totalEvolutions: records.length,
    totalIssues: records.reduce((a, r) => a + r.issues, 0),
    totalActions: records.reduce((a, r) => a + r.actions, 0),
    sumROIDelta: withDeltas.reduce((a, r) => a + (r.delta?.roi || 0), 0),
    sumRiskDelta: withDeltas.reduce((a, r) => a + (r.delta?.risk || 0), 0),
    sumDebtDelta: withDeltas.reduce((a, r) => a + (r.delta?.debt || 0), 0),
    sumHealthDelta: withDeltas.reduce((a, r) => a + (r.delta?.health || 0), 0),
    modeBreakdown,
    records,
  }
}

export function ResilienceScorecard({ open, onOpenChange, currentBlueprint }: ScorecardDialogProps) {
  const [metrics, setMetrics] = useState<AggregatedMetrics | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    try {
      const raw = localStorage.getItem("evolutionHistory")
      const records: EvolutionRecord[] = raw ? JSON.parse(raw) : []
      setMetrics(aggregate(records))
    } catch {
      setMetrics(aggregate([]))
    }
  }, [open])

  const copyReport = async () => {
    if (!metrics) return
    const now = new Date().toLocaleString()
    const lines = [
      "ARCHISYNAPSE RESILIENCE SCORECARD",
      `Generated: ${now}`,
      "",
      "=== SUMMARY ===",
      `Total Evolutions: ${metrics.totalEvolutions}`,
      `Total Issues Detected: ${metrics.totalIssues}`,
      `Total Actions Applied: ${metrics.totalActions}`,
      "",
      "=== CUMULATIVE DELTAS ===",
      `ROI: ${metrics.sumROIDelta > 0 ? "+" : ""}${metrics.sumROIDelta}%`,
      `Risk Reduced: ${metrics.sumRiskDelta}`,
      `Tech Debt Reduced: ${metrics.sumDebtDelta}`,
      `Health Gained: ${metrics.sumHealthDelta}`,
      "",
      "=== MODE BREAKDOWN ===",
      ...Object.entries(metrics.modeBreakdown).map(([mode, count]) =>
        `  ${MODE_LABELS[mode] || mode}: ${count} run${count !== 1 ? "s" : ""}`
      ),
      "",
      "=== RECENT EVOLUTIONS ===",
      ...metrics.records.slice(0, 10).map((r, i) =>
        `  ${i + 1}. ${MODE_LABELS[r.preset] || r.preset} | ${r.issues} issues, ${r.actions} actions | ROI ${r.delta ? (r.delta.roi > 0 ? "+" : "") + r.delta.roi + "%" : "N/A"}`
      ),
    ]
    try {
      await navigator.clipboard.writeText(lines.join("\n"))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col glass-panel bg-background/80 backdrop-blur-3xl border-white/10 print:bg-white print:text-black">
        <DialogHeader>
          <DialogTitle className="font-headline text-lg tracking-tight">Resilience Scorecard</DialogTitle>
          <DialogDescription>
            Aggregate intelligence across all evolution cycles
            {metrics && ` · ${metrics.totalEvolutions} evolution${metrics.totalEvolutions !== 1 ? "s" : ""}`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {!metrics ? (
            <div className="text-center py-12 text-muted-foreground/40">
              <p className="text-[10px] font-bold uppercase tracking-widest">Loading...</p>
            </div>
          ) : metrics.totalEvolutions === 0 ? (
            <div className="text-center py-12 text-muted-foreground/40">
              <RefreshCw size={28} className="mx-auto mb-3 opacity-30" />
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1">No Evolution Data</p>
              <p className="text-[9px] text-muted-foreground/60">Run Auto-Heal or an evolution preset to generate scorecard data.</p>
            </div>
          ) : (
            <div className="space-y-6 py-2">
              {/* Big Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total Evolutions</span>
                  <p className="text-3xl font-bold font-heading mt-1">{metrics.totalEvolutions}</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Issues Resolved</span>
                  <p className="text-3xl font-bold font-heading mt-1">{metrics.totalIssues}</p>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">ROI Delta</span>
                  <p className="text-3xl font-bold font-heading mt-1 text-emerald-400">
                    {metrics.sumROIDelta > 0 ? "+" : ""}{metrics.sumROIDelta}%
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 text-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-orange-400">Risk Reduced</span>
                  <p className="text-3xl font-bold font-heading mt-1 text-orange-400">{metrics.sumRiskDelta}</p>
                </div>
                <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 text-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Debt Reduced</span>
                  <p className="text-3xl font-bold font-heading mt-1 text-blue-400">{metrics.sumDebtDelta}</p>
                </div>
                <div className="p-4 rounded-2xl bg-accent/5 border border-accent/20 text-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-accent">Health Gained</span>
                  <p className="text-3xl font-bold font-heading mt-1 text-accent">{metrics.sumHealthDelta}</p>
                </div>
              </div>

              {/* Current State */}
              {currentBlueprint && (
                <div>
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Current Architecture State</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                      <span className="text-[8px] text-muted-foreground block">Avg ROI</span>
                      <span className="text-lg font-bold font-heading text-emerald-400">{currentBlueprint.avgROI}%</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                      <span className="text-[8px] text-muted-foreground block">Risk Exposure</span>
                      <span className="text-lg font-bold font-heading text-orange-400">{currentBlueprint.totalRisk}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                      <span className="text-[8px] text-muted-foreground block">Healthy</span>
                      <span className="text-lg font-bold font-heading text-emerald-400">{currentBlueprint.healthyCount}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode Breakdown */}
              <div>
                <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Mode Usage</h3>
                <div className="space-y-1">
                  {Object.entries(metrics.modeBreakdown).map(([mode, count]) => {
                    const Icon = MODE_ICONS[mode] || RefreshCw
                    const color = MODE_COLORS[mode] || "text-muted-foreground"
                    return (
                      <div key={mode} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02]">
                        <div className="flex items-center gap-2">
                          <Icon size={10} className={color} />
                          <span className="text-xs">{MODE_LABELS[mode] || mode}</span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground/60">{count} run{count !== 1 ? "s" : ""}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Recent Evolution Deltas */}
              <div>
                <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Recent Deltas</h3>
                <div className="space-y-1">
                  {metrics.records.slice(0, 5).map((r, i) => (
                    <div key={r.id || i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-muted-foreground/40 font-mono shrink-0">
                          {new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider truncate">
                          {MODE_LABELS[r.preset] || r.preset}
                        </span>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {r.delta && (
                          <>
                            {r.delta.roi !== 0 && (
                              <span className={cn("text-[8px] font-mono flex items-center gap-0.5", r.delta.roi > 0 ? "text-emerald-400" : "text-red-400")}>
                                {r.delta.roi > 0 ? <ArrowUp size={8} /> : <ArrowDown size={8} />}{Math.abs(r.delta.roi)}%
                              </span>
                            )}
                            {r.delta.health !== 0 && (
                              <span className={cn("text-[8px] font-mono flex items-center gap-0.5", r.delta.health > 0 ? "text-accent" : "text-red-400")}>
                                {r.delta.health > 0 ? <ArrowUp size={8} /> : <ArrowDown size={8} />}{Math.abs(r.delta.health)}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={copyReport} className="rounded-xl text-[9px]">
            {copied ? "Copied" : "Copy Report"}
          </Button>
          <Button size="sm" onClick={() => window.print()} className="rounded-xl text-[9px] bg-accent text-black hover:bg-accent/90">
            Print / Export PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
