"use client"

import { ArchComponent } from "@/types/architecture"
import { TrendingUp, Shield, DollarSign, Clock, Activity, Zap } from "lucide-react"

interface BusinessROIInspectorProps {
  component: ArchComponent
}

export function BusinessROIInspector({ component }: BusinessROIInspectorProps) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold font-heading">{component.name}</h3>
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{component.type}</span>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{component.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <TrendingUp size={14} className="text-emerald-400 mb-1" />
          <span className="text-[9px] text-muted-foreground block">ROI Potential</span>
          <span className="text-lg font-bold font-heading text-emerald-400">{component.roiScore}/100</span>
        </div>
        <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
          <Shield size={14} className="text-orange-400 mb-1" />
          <span className="text-[9px] text-muted-foreground block">Risk Score</span>
          <span className="text-lg font-bold font-heading text-orange-400">{component.riskScore}/100</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/5">
          <div className="flex items-center gap-2">
            <Activity size={10} className="text-cyan-400/60" />
            <span className="text-xs text-muted-foreground">Latency</span>
          </div>
          <span className="font-mono text-xs">{component.latency}ms</span>
        </div>
        <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/5">
          <div className="flex items-center gap-2">
            <Zap size={10} className="text-cyan-400/60" />
            <span className="text-xs text-muted-foreground">Throughput</span>
          </div>
          <span className="font-mono text-xs">{component.throughput}/s</span>
        </div>
        <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/5">
          <div className="flex items-center gap-2">
            <Activity size={10} className="text-blue-400/60" />
            <span className="text-xs text-muted-foreground">Tech Debt</span>
          </div>
          <span className="font-mono text-xs">{component.techDebtScore}/100</span>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
        <DollarSign size={14} className="text-primary mb-1" />
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Revenue Enablement</span>
        <span className="text-sm font-heading text-primary font-bold">
          {component.roiScore > 80 ? "High-Yield Asset — Core Revenue Driver" :
           component.roiScore > 60 ? "Growth Asset — Monetization Ready" :
           "Supporting Infrastructure — Enables Revenue"}
        </span>
      </div>
    </div>
  )
}
