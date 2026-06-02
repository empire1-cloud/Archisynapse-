"use client"

import { useMemo } from "react"
import { Blueprint } from "@/types/architecture"
import { Shield, AlertTriangle, TrendingUp, ArrowLeftRight, DollarSign } from "lucide-react"
import { cn } from "@/lib/utils"

interface AIAnalysisPanelProps {
  blueprint: Blueprint
}

export function AIAnalysisPanel({ blueprint }: AIAnalysisPanelProps) {
  const analysis = useMemo(() => {
    const points: { type: string; message: string; severity: "low" | "medium" | "high" }[] = []
    const types = blueprint.components.map(c => c.type)

    if (types.includes("payment-processor") && !types.includes("fraud-detection")) {
      points.push({ type: "security", message: "Payment processor without fraud detection — high chargeback risk", severity: "high" })
    }
    if (types.includes("database") && !types.includes("cache")) {
      points.push({ type: "performance", message: "Database without cache — potential latency bottleneck under load", severity: "medium" })
    }
    if (types.includes("user-interface") && !types.includes("gateway")) {
      points.push({ type: "security", message: "UI exposed without gateway — missing auth and rate limiting", severity: "high" })
    }
    if (!types.includes("analytics")) {
      points.push({ type: "insight", message: "No analytics engine — missing revenue intelligence", severity: "low" })
    }
    if (blueprint.components.length < 3) {
      points.push({ type: "scale", message: "Architecture may lack redundancy for production workloads", severity: "medium" })
    }

    return points
  }, [blueprint])

  const avgROI = blueprint.components.length
    ? Math.round(blueprint.components.reduce((a, c) => a + c.roiScore, 0) / blueprint.components.length)
    : 0
  const totalRisk = blueprint.components.reduce((a, c) => a + c.riskScore, 0)

  return (
    <div className="p-5 space-y-6">
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Strategic Audit</h3>
        <div className="space-y-2">
          {analysis.map((point, i) => (
            <div key={i} className={cn(
              "flex items-start gap-2.5 p-3 rounded-xl border",
              point.severity === "high" ? "bg-orange-500/5 border-orange-500/20" :
              point.severity === "medium" ? "bg-yellow-500/5 border-yellow-500/20" :
              "bg-blue-500/5 border-blue-500/20"
            )}>
              {point.type === "security" ? <Shield size={12} className="mt-0.5 shrink-0 text-orange-400" /> :
               point.type === "performance" ? <TrendingUp size={12} className="mt-0.5 shrink-0 text-yellow-400" /> :
               <AlertTriangle size={12} className="mt-0.5 shrink-0 text-blue-400" />}
              <span className="text-xs text-muted-foreground leading-relaxed">{point.message}</span>
            </div>
          ))}
          {analysis.length === 0 && (
            <div className="text-center py-8 text-muted-foreground/40">
              <Shield size={24} className="mx-auto mb-2 opacity-30" />
              <p className="text-[10px] font-bold uppercase tracking-widest">No strategic gaps detected</p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Portfolio Analytics</h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="text-[9px] text-muted-foreground block mb-0.5">Avg ROI</span>
            <span className="text-lg font-bold font-heading text-emerald-400">{avgROI}%</span>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="text-[9px] text-muted-foreground block mb-0.5">Risk Exposure</span>
            <span className="text-lg font-bold font-heading text-orange-400">{totalRisk}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Revenue Enablement</h3>
        <div className="space-y-2">
          {blueprint.components.filter(c => c.roiScore > 70).map(c => (
            <div key={c.id} className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-2">
                <DollarSign size={10} className="text-emerald-400/60" />
                <span className="text-xs">{c.name}</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400">{c.roiScore}% ROI</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
