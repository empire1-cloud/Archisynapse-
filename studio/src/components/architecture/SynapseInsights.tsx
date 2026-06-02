"use client"

import { useMemo, useState } from "react"
import { Blueprint, ArchComponent, ComponentType } from "@/types/architecture"
import { Sparkles, TrendingUp, Shield, Zap, Cpu, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { analyzeArchitecture } from "@/ai/flows/design-partner-flow"

interface SynapseInsightsProps {
  blueprint: Blueprint
  onAddComponent: (type: ComponentType) => void
  onUpdateBlueprint: (bp: Blueprint) => void
}

export function SynapseInsights({ blueprint, onAddComponent, onUpdateBlueprint }: SynapseInsightsProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [suggestions, setSuggestions] = useState<{ componentType: string; reason: string; businessImpact: string; revenueDelta: number }[]>([])

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      const result = await analyzeArchitecture(blueprint.components)
      setSuggestions(result)
    } catch {
      // fallback handled in the flow
    } finally {
      setAnalyzing(false)
    }
  }

  const handleEvolve = (objective: string) => {
    const newComponents = [...blueprint.components]
    if (objective === "roi" && !blueprint.components.some(c => c.type === "fee-engine")) {
      newComponents.push({
        id: `c-${Date.now()}`,
        name: "Fee Engine",
        type: "fee-engine",
        description: "Automated fee collection and commission calculation",
        config: {},
        position: { x: 300 + newComponents.length * 30, y: 400 },
        roiScore: 85,
        riskScore: 15,
        status: "healthy",
        latency: 20,
        throughput: 2000,
        techDebtScore: 5,
      })
    }
    if (objective === "security" && !blueprint.components.some(c => c.type === "fraud-detection")) {
      newComponents.push({
        id: `c-${Date.now()}`,
        name: "Fraud Detection",
        type: "fraud-detection",
        description: "ML-based transaction scoring",
        config: {},
        position: { x: 500 + newComponents.length * 30, y: 400 },
        roiScore: 80,
        riskScore: 20,
        status: "healthy",
        latency: 30,
        throughput: 1500,
        techDebtScore: 8,
      })
    }
    if (objective === "scale" && !blueprint.components.some(c => c.type === "cache")) {
      newComponents.push({
        id: `c-${Date.now()}`,
        name: "Cache Layer",
        type: "cache",
        description: "Redis-backed low-latency cache",
        config: {},
        position: { x: 400 + newComponents.length * 30, y: 300 },
        roiScore: 65,
        riskScore: 5,
        status: "healthy",
        latency: 2,
        throughput: 10000,
        techDebtScore: 3,
      })
    }

    onUpdateBlueprint({ ...blueprint, components: newComponents })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-accent flex items-center gap-2">
          <Sparkles size={12} /> Synapse Engine
        </h3>
        <Button variant="glow" size="sm" onClick={handleAnalyze} disabled={analyzing} className="text-[9px] h-7 px-3">
          {analyzing ? <Loader2 size={10} className="animate-spin mr-1" /> : <Zap size={10} className="mr-1" />}
          Scan
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((s, i) => (
            <div key={i} className="p-3 rounded-xl bg-accent/5 border border-accent/10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-accent flex items-center gap-1.5">
                  <Cpu size={10} /> {s.componentType}
                </span>
                <span className="text-[9px] font-mono text-emerald-400">+{s.revenueDelta}%</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">{s.businessImpact}</p>
              <Button
                variant="outline"
                size="sm"
                className="text-[9px] h-7 w-full"
                onClick={() => onAddComponent(s.componentType as ComponentType)}
              >
                Add {s.componentType}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div>
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Agentic Evolution</h3>
        <div className="space-y-1.5">
          <Button variant="ghost" size="sm" className="w-full justify-start text-[9px] h-8" onClick={() => handleEvolve("roi")}>
            <TrendingUp size={10} className="mr-2 text-emerald-400" /> Optimize ROI
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-[9px] h-8" onClick={() => handleEvolve("security")}>
            <Shield size={10} className="mr-2 text-orange-400" /> Harden Security
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-[9px] h-8" onClick={() => handleEvolve("scale")}>
            <Zap size={10} className="mr-2 text-cyan-400" /> Hyper-Scale
          </Button>
        </div>
      </div>
    </div>
  )
}
