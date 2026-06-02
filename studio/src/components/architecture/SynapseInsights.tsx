"use client"

import { useMemo, useState, useCallback, useEffect } from "react"
import { Blueprint, ArchComponent, ComponentType } from "@/types/architecture"
import { Sparkles, TrendingUp, Shield, Zap, Cpu, Loader2, AlertTriangle, CheckCircle, RefreshCw, History, Sliders } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { analyzeArchitecture } from "@/ai/flows/design-partner-flow"
import {
  runAgenticEvolution,
  analyzeBlueprint,
  applyActions,
  type DetectedIssue,
  type RepairAction,
  type EvolutionPreset,
  type ThresholdConfig,
  type EvolutionRecord,
} from "@/ai/flows/agentic-evolution-flow"
import { EvolutionConfirmDialog } from "./EvolutionConfirmDialog"

const LOCALSTORAGE_KEY = "archisynapse-evolution-history"

function loadHistory(): EvolutionRecord[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveHistory(records: EvolutionRecord[]) {
  try { localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(records)) } catch {}
}

const AGGRESSION_LEVELS: { value: ThresholdConfig["aggression"]; label: string; desc: string }[] = [
  { value: "conservative", label: "Safe", desc: "Only critical failures & security gaps" },
  { value: "balanced", label: "Balanced", desc: "Medium+ severity, standard recommendations" },
  { value: "aggressive", label: "Aggressive", desc: "All issues, expand aggressively" },
]

interface SynapseInsightsProps {
  blueprint: Blueprint
  onAddComponent: (type: ComponentType) => void
  onUpdateBlueprint: (bp: Blueprint) => void
}

export function SynapseInsights({ blueprint, onAddComponent, onUpdateBlueprint }: SynapseInsightsProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [suggestions, setSuggestions] = useState<{ componentType: string; reason: string; businessImpact: string; revenueDelta: number }[]>([])
  const [evolving, setEvolving] = useState(false)
  const [evolutionLog, setEvolutionLog] = useState<{ issues: DetectedIssue[]; actions: RepairAction[] } | null>(null)
  const [aggression, setAggression] = useState<ThresholdConfig["aggression"]>("balanced")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingAnalysis, setPendingAnalysis] = useState<{ issues: DetectedIssue[]; actions: RepairAction[]; preset: EvolutionPreset } | null>(null)
  const [history, setHistory] = useState<EvolutionRecord[]>([])
  const [showTimeline, setShowTimeline] = useState(false)
  const [showThresholds, setShowThresholds] = useState(false)

  useEffect(() => { setHistory(loadHistory()) }, [])

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

  const handleAutoHeal = (preset: EvolutionPreset = "auto") => {
    const { issues, actions } = analyzeBlueprint(blueprint, { aggression }, preset)
    if (actions.length === 0) {
      setEvolutionLog({ issues, actions })
      return
    }
    setPendingAnalysis({ issues, actions, preset })
    setConfirmOpen(true)
  }

  const handleConfirmEvolution = (selectedActions: RepairAction[]) => {
    if (!pendingAnalysis) return
    const updated = applyActions(blueprint, selectedActions)
    onUpdateBlueprint(updated)
    setEvolutionLog({ issues: pendingAnalysis.issues, actions: selectedActions })

    const record: EvolutionRecord = {
      id: `ev-${Date.now()}`,
      timestamp: new Date().toISOString(),
      preset: pendingAnalysis.preset,
      aggression,
      issues: pendingAnalysis.issues.length,
      actions: selectedActions.length,
      actionSummaries: selectedActions.map(a =>
        a.action === "reset" ? `Reset failed component` :
        a.action === "add" ? `Added ${a.componentName}` : a.action
      ),
    }
    const updatedHistory = [record, ...history].slice(0, 20)
    setHistory(updatedHistory)
    saveHistory(updatedHistory)

    setPendingAnalysis(null)
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

  const presetActions: { preset: EvolutionPreset; label: string; icon: typeof TrendingUp; color: string }[] = [
    { preset: "roi", label: "ROI Mode", icon: TrendingUp, color: "text-emerald-400" },
    { preset: "security", label: "Security Mode", icon: Shield, color: "text-orange-400" },
    { preset: "scale", label: "Scale Mode", icon: Zap, color: "text-cyan-400" },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-accent flex items-center gap-2">
          <Sparkles size={12} /> Synapse Engine
        </h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => setShowThresholds(!showThresholds)}>
            <Sliders size={12} className={cn(showThresholds ? "text-accent" : "text-muted-foreground")} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => setShowTimeline(!showTimeline)}>
            <History size={12} className={cn(showTimeline ? "text-accent" : "text-muted-foreground")} />
          </Button>
          <Button variant="glow" size="sm" onClick={handleAnalyze} disabled={analyzing} className="text-[9px] h-7 px-3">
            {analyzing ? <Loader2 size={10} className="animate-spin mr-1" /> : <Zap size={10} className="mr-1" />}
            Scan
          </Button>
        </div>
      </div>

      {showThresholds && (
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
          <h4 className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Aggression Level</h4>
          <div className="flex gap-1">
            {AGGRESSION_LEVELS.map(al => (
              <button
                key={al.value}
                onClick={() => setAggression(al.value)}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border",
                  aggression === al.value
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "bg-white/[0.02] border-white/5 text-muted-foreground hover:bg-white/5"
                )}
              >
                {al.label}
              </button>
            ))}
          </div>
          <p className="text-[8px] text-muted-foreground/60">{AGGRESSION_LEVELS.find(al => al.value === aggression)?.desc}</p>
        </div>
      )}

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
          <Button
            variant="glow"
            size="sm"
            className={cn("w-full justify-start text-[9px] h-8", evolving && "animate-pulse")}
            onClick={() => handleAutoHeal("auto")}
            disabled={evolving}
          >
            {evolving ? <Loader2 size={10} className="animate-spin mr-2" /> : <RefreshCw size={10} className="mr-2 text-accent" />}
            {evolving ? "Evolving..." : "Auto-Heal (Full Spectrum)"}
          </Button>
          {presetActions.map(pa => (
            <Button
              key={pa.preset}
              variant="ghost"
              size="sm"
              className="w-full justify-start text-[9px] h-8"
              onClick={() => handleAutoHeal(pa.preset)}
            >
              <pa.icon size={10} className={cn("mr-2", pa.color)} /> {pa.label}
            </Button>
          ))}
        </div>
      </div>

      {evolutionLog && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Evolution Log
            <span className="ml-2 text-[9px] font-mono text-muted-foreground/40">
              ({evolutionLog.issues.length} issues, {evolutionLog.actions.length} actions)
            </span>
          </h3>
          {evolutionLog.issues.length === 0 && evolutionLog.actions.length === 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <CheckCircle size={12} className="text-emerald-400 shrink-0" />
              <span className="text-[10px] text-muted-foreground">All systems nominal — no evolution needed</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {evolutionLog.actions.map((action, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-accent/5 border border-accent/10">
                  <CheckCircle size={10} className="mt-0.5 shrink-0 text-emerald-400" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-semibold text-accent block leading-tight">
                      {action.action === "reset" ? `Reset ${action.targetId?.slice(0, 8)}` :
                       action.action === "add" ? `Added ${action.componentName || action.componentType}` :
                       action.action}
                    </span>
                    <span className="text-[8px] text-muted-foreground/60 block mt-0.5">{action.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showTimeline && (
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">
            Evolution Timeline
            <span className="ml-2 text-[9px] font-mono text-muted-foreground/40">({history.length})</span>
          </h3>
          {history.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground/40">
              <History size={20} className="mx-auto mb-2 opacity-30" />
              <p className="text-[9px] font-bold uppercase tracking-widest">No evolutions recorded yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {history.map((rec) => (
                <div key={rec.id} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-accent">
                      {rec.preset === "auto" ? "Full Spectrum" : `${rec.preset.charAt(0).toUpperCase() + rec.preset.slice(1)} Mode`}
                    </span>
                    <span className="text-[8px] font-mono text-muted-foreground/40">
                      {new Date(rec.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex gap-2 mb-1">
                    <span className="text-[8px] text-muted-foreground/60 bg-white/5 px-1.5 py-0.5 rounded">{rec.issues} issues</span>
                    <span className="text-[8px] text-emerald-400/60 bg-emerald-500/5 px-1.5 py-0.5 rounded">{rec.actions} actions</span>
                    <span className="text-[8px] text-muted-foreground/40 bg-white/5 px-1.5 py-0.5 rounded">{rec.aggression}</span>
                  </div>
                  {rec.actionSummaries.length > 0 && (
                    <div className="space-y-0.5">
                      {rec.actionSummaries.map((s, i) => (
                        <p key={i} className="text-[8px] text-muted-foreground/60 pl-2 border-l border-white/5">{s}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <EvolutionConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        issues={pendingAnalysis?.issues || []}
        actions={pendingAnalysis?.actions || []}
        onConfirm={handleConfirmEvolution}
      />
    </div>
  )
}
