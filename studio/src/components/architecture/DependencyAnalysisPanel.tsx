"use client"

import { useMemo } from "react"
import { Blueprint } from "@/types/architecture"
import { AlertTriangle, DollarSign, ArrowRight, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

interface DependencyAnalysisPanelProps {
  blueprint: Blueprint
}

export function DependencyAnalysisPanel({ blueprint }: DependencyAnalysisPanelProps) {
  const analysis = useMemo(() => {
    const failures = blueprint.components.filter(c => c.status === "failed").map(c => c.id)
    const impacted: { name: string; reason: string; revenueAtRisk: number }[] = []

    blueprint.dependencies.forEach(d => {
      if (failures.includes(d.sourceId) || failures.includes(d.targetId)) {
        const target = blueprint.components.find(c => c.id === d.targetId)
        if (target) {
          impacted.push({
            name: target.name,
            reason: `Dependency on failed component`,
            revenueAtRisk: Math.round(target.roiScore * 10),
          })
        }
      }
    })

    return impacted
  }, [blueprint])

  const failedComponents = blueprint.components.filter(c => c.status === "failed")

  return (
    <div className="p-5 space-y-6">
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Dependency Impact</h3>
        {failedComponents.length > 0 ? (
          <div className="space-y-2">
            {failedComponents.map(c => (
              <div key={c.id} className="p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={12} className="text-red-400" />
                  <span className="text-xs font-semibold text-red-400">{c.name}</span>
                </div>
                <span className="text-[10px] text-muted-foreground block">Status: Failed — cascading impact on downstream services</span>
              </div>
            ))}
            <div className="mt-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-orange-400 mb-2 block">Revenue at Risk</span>
              {analysis.map((a, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 text-xs">
                  <ArrowRight size={10} className="text-orange-400/60 shrink-0" />
                  <span className="text-muted-foreground flex-1">{a.name}</span>
                  <span className="font-mono text-orange-400">-${a.revenueAtRisk}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground/40">
            <Shield size={24} className="mx-auto mb-2 opacity-30" />
            <p className="text-[10px] font-bold uppercase tracking-widest">All systems operational</p>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Recovery Priority</h3>
        <div className="space-y-1">
          {blueprint.components
            .sort((a, b) => b.roiScore - a.roiScore)
            .slice(0, 5)
            .map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02]">
                <span className={cn(
                  "text-[9px] font-black w-4",
                  i === 0 ? "text-red-400" : i === 1 ? "text-orange-400" : "text-muted-foreground"
                )}>P{i + 1}</span>
                <span className="text-xs flex-1">{c.name}</span>
                <span className="text-[10px] font-mono text-emerald-400/60">{c.roiScore}% ROI</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
