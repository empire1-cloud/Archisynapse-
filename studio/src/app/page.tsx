"use client"

import { useEffect, useMemo, useState } from "react"
import { Activity, AlertTriangle, BarChart3, Clock, RefreshCw, Shield, TrendingUp } from "lucide-react"
import { ArchitectureCanvas } from "@/components/ArchitectureCanvas"
import { type CanvasComponent } from "@/components/ArchitectureNode"
import { LeftSidebar } from "@/components/LeftSidebar"
import { RightAnalytics } from "@/components/RightAnalytics"
import { TopBar } from "@/components/TopBar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api, type Blueprint, type DashboardResponse, type GraphInfo, type GraphRecommendation, type HealthResponse, type PayoutRecord, type RiskSummaryResponse, type TrialBalanceResponse } from "@/lib/api"
import { getComponentType } from "@/components/ComponentRegistry"
import { cn } from "@/lib/utils"

type StudioMode = "studio" | "neural" | "yield" | "risk"

const COMPONENT_BLUEPRINT_MAP: Record<string, string[]> = {
  gateway: ["compliance-aware-routing"],
  "lyrica-rail": ["event-driven-settlement", "micro-royalty-streaming"],
  ledger: ["event-driven-settlement", "digital-asset-provenance"],
  analytics: ["creator-subscription-model", "event-driven-settlement"],
  "fraud-detection": ["compliance-aware-routing"],
  "dna-tagger": ["digital-asset-provenance", "attribution-graph-pattern"],
  "soulfire-engine": ["ai-music-generation-pipeline", "multi-agent-workflow"],
  "micro-royalties": ["micro-royalty-streaming", "creator-royalty-split"],
  "marketplace-api": ["marketplace-escrow-pattern"],
  "fee-collector": ["creator-subscription-model", "event-driven-settlement"],
  "reputation-svc": ["compliance-aware-routing"],
}

const DEFAULT_EDGES = [
  { id: "edge-dashboard-gateway", sourceId: "dashboard-live", targetId: "gateway-live" },
  { id: "edge-gateway-rail", sourceId: "gateway-live", targetId: "rail-live" },
  { id: "edge-gateway-risk", sourceId: "gateway-live", targetId: "risk-live" },
  { id: "edge-risk-rail", sourceId: "risk-live", targetId: "rail-live" },
  { id: "edge-rail-ledger", sourceId: "rail-live", targetId: "ledger-live" },
  { id: "edge-gateway-analytics", sourceId: "gateway-live", targetId: "analytics-live" },
  { id: "edge-rail-analytics", sourceId: "rail-live", targetId: "analytics-live" },
]

const MODE_OPTIONS: Array<{ id: StudioMode; label: string }> = [
  { id: "studio", label: "Studio" },
  { id: "neural", label: "Neural" },
  { id: "yield", label: "Yield" },
  { id: "risk", label: "Risk" },
]

function toPercent(value: number) {
  return `${Math.round(value)}%`
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max)
}

function buildLiveComponents({
  dashboard,
  health,
  graphInfo,
  riskSummary,
  trialBalance,
  unpostedPayouts,
}: {
  dashboard: DashboardResponse | null
  health: HealthResponse | null
  graphInfo: GraphInfo | null
  riskSummary: RiskSummaryResponse | null
  trialBalance: TrialBalanceResponse | null
  unpostedPayouts: PayoutRecord[]
}): CanvasComponent[] {
  const successRate = dashboard?.metrics.success_rate_percent ?? 0
  const averageResponseTime = dashboard?.metrics.average_response_time_ms ?? 20
  const volume = dashboard?.metrics.total_volume_formatted ?? "$0.00"
  const activeCustomers = dashboard?.metrics.active_customers ?? 0
  const pendingPayouts = dashboard?.metrics.pending_payouts ?? unpostedPayouts.length
  const graphCoverage = graphInfo ? clamp((graphInfo.nodes / 12) * 100) : 0
  const ledgerIntegrity = trialBalance?.isBalanced ? 100 : 72
  const bridgeHealthy = health?.status === "ok"
  const reviewQueue = (riskSummary?.blockedPayoutEvents ?? 0) + (riskSummary?.manualReviewEvents ?? 0)
  const riskShield = riskSummary ? clamp(100 - riskSummary.averageRiskScore) : 58

  return [
    {
      id: "dashboard-live",
      type: "user-interface",
      position: { x: 120, y: 520 },
      status: bridgeHealthy ? "healthy" : "failed",
      label: "Merchant Dashboard",
      subtitle: "Registry Surface",
      metricLabel: "Volume",
      metricValue: volume,
      latencyMs: 12,
    },
    {
      id: "gateway-live",
      type: "gateway",
      position: { x: 700, y: 140 },
      status: bridgeHealthy ? "healthy" : "failed",
      label: "API Gateway",
      subtitle: "Compliance Gateway",
      metricLabel: "Yield",
      metricValue: toPercent(successRate),
      latencyMs: averageResponseTime,
    },
    {
      id: "rail-live",
      type: "lyrica-rail",
      position: { x: 1640, y: 320 },
      status: pendingPayouts > 0 ? "standby" : "healthy",
      label: "Lyrica Clearing Rail",
      subtitle: "Settlement Orchestrator",
      metricLabel: "Pending",
      metricValue: `${pendingPayouts}`,
      latencyMs: 20,
    },
    {
      id: "risk-live",
      type: "fraud-detection",
      position: { x: 1260, y: 180 },
      status: riskSummary ? (reviewQueue > 0 ? "standby" : "healthy") : "standby",
      label: "ML Risk Sentinel",
      subtitle: `${riskSummary?.totalEvents ?? 0} live risk events`,
      metricLabel: "Shield",
      metricValue: toPercent(riskShield),
      latencyMs: 14,
    },
    {
      id: "ledger-live",
      type: "ledger",
      position: { x: 920, y: 1180 },
      status: trialBalance?.isBalanced ? "healthy" : "standby",
      label: "Immutable Ledger",
      subtitle: "Ledger Truth",
      metricLabel: "Integrity",
      metricValue: toPercent(ledgerIntegrity),
      latencyMs: 8,
    },
    {
      id: "analytics-live",
      type: "analytics",
      position: { x: 2200, y: 1160 },
      status: graphInfo ? "healthy" : "standby",
      label: "Neural Analytics",
      subtitle: `${activeCustomers} active customers`,
      metricLabel: "Coverage",
      metricValue: toPercent(graphCoverage),
      latencyMs: 26,
    },
  ]
}

export default function ArchisynapseStudioPage() {
  const [activeNav, setActiveNav] = useState("registry")
  const [activeMode, setActiveMode] = useState<StudioMode>("studio")
  const [components, setComponents] = useState<CanvasComponent[]>([])
  const [edges] = useState(DEFAULT_EDGES)
  const [selectedId, setSelectedId] = useState<string | null>("gateway-live")
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [graphInfo, setGraphInfo] = useState<GraphInfo | null>(null)
  const [riskSummary, setRiskSummary] = useState<RiskSummaryResponse | null>(null)
  const [trialBalance, setTrialBalance] = useState<TrialBalanceResponse | null>(null)
  const [unpostedPayouts, setUnpostedPayouts] = useState<PayoutRecord[]>([])
  const [heldPayouts, setHeldPayouts] = useState<PayoutRecord[]>([])
  const [blueprints, setBlueprints] = useState<Blueprint[]>([])
  const [recommendations, setRecommendations] = useState<GraphRecommendation[]>([])
  const [lastAction, setLastAction] = useState("Live registry booted")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [releasingPayoutId, setReleasingPayoutId] = useState<string | null>(null)
  const [errorMessages, setErrorMessages] = useState<string[]>([])

  const loadStudio = async (reason = "Live registry refreshed") => {
    setBusy(true)
    const results = await Promise.allSettled([
      api.health(),
      api.dashboard(),
      api.graphInfo(),
      api.riskSummary(),
      api.ledgerTrialBalance(),
      api.listPayouts({ status: "pending", limit: 12 }),
      api.listUnpostedPayouts(),
      api.listBlueprints({ limit: 24 }),
    ])

    const failures: string[] = []

    const healthResult = results[0]
    const dashboardResult = results[1]
    const graphInfoResult = results[2]
    const riskSummaryResult = results[3]
    const trialBalanceResult = results[4]
    const pendingPayoutsResult = results[5]
    const unpostedResult = results[6]
    const blueprintsResult = results[7]

    const nextHealth = healthResult.status === "fulfilled" ? healthResult.value : null
    if (healthResult.status === "rejected") failures.push(`health: ${healthResult.reason instanceof Error ? healthResult.reason.message : "request failed"}`)

    const nextDashboard = dashboardResult.status === "fulfilled" ? dashboardResult.value : null
    if (dashboardResult.status === "rejected") failures.push(`dashboard: ${dashboardResult.reason instanceof Error ? dashboardResult.reason.message : "request failed"}`)

    const nextGraphInfo = graphInfoResult.status === "fulfilled" ? graphInfoResult.value : null
    if (graphInfoResult.status === "rejected") failures.push(`graph: ${graphInfoResult.reason instanceof Error ? graphInfoResult.reason.message : "request failed"}`)

    const nextRiskSummary = riskSummaryResult.status === "fulfilled" ? riskSummaryResult.value : null
    if (riskSummaryResult.status === "rejected") failures.push(`risk: ${riskSummaryResult.reason instanceof Error ? riskSummaryResult.reason.message : "request failed"}`)

    const nextTrialBalance = trialBalanceResult.status === "fulfilled" ? trialBalanceResult.value : null
    if (trialBalanceResult.status === "rejected") failures.push(`ledger: ${trialBalanceResult.reason instanceof Error ? trialBalanceResult.reason.message : "request failed"}`)

    const nextHeldPayouts = pendingPayoutsResult.status === "fulfilled"
      ? pendingPayoutsResult.value.data.filter((payout) => payout.manualReviewRequired)
      : []
    if (pendingPayoutsResult.status === "rejected") failures.push(`pending-payouts: ${pendingPayoutsResult.reason instanceof Error ? pendingPayoutsResult.reason.message : "request failed"}`)

    const nextUnpostedPayouts = unpostedResult.status === "fulfilled" ? unpostedResult.value.data : []
    if (unpostedResult.status === "rejected") failures.push(`payouts: ${unpostedResult.reason instanceof Error ? unpostedResult.reason.message : "request failed"}`)

    const nextBlueprints = blueprintsResult.status === "fulfilled" ? blueprintsResult.value.items : []
    if (blueprintsResult.status === "rejected") failures.push(`blueprints: ${blueprintsResult.reason instanceof Error ? blueprintsResult.reason.message : "request failed"}`)

    setHealth(nextHealth)
    setDashboard(nextDashboard)
    setGraphInfo(nextGraphInfo)
    setRiskSummary(nextRiskSummary)
    setTrialBalance(nextTrialBalance)
    setHeldPayouts(nextHeldPayouts)
    setUnpostedPayouts(nextUnpostedPayouts)
    setBlueprints(nextBlueprints)
    setComponents(buildLiveComponents({
      dashboard: nextDashboard,
      health: nextHealth,
      graphInfo: nextGraphInfo,
      riskSummary: nextRiskSummary,
      trialBalance: nextTrialBalance,
      unpostedPayouts: nextUnpostedPayouts,
    }))
    setErrorMessages(failures)
    setLastAction(reason)
    setLoading(false)
    setBusy(false)
  }

  useEffect(() => {
    loadStudio().catch((error) => {
      setErrorMessages([error instanceof Error ? error.message : "Studio bootstrap failed"])
      setComponents(buildLiveComponents({
        dashboard: null,
        health: null,
        graphInfo: null,
        riskSummary: null,
        trialBalance: null,
        unpostedPayouts: [],
      }))
      setHeldPayouts([])
      setLoading(false)
      setBusy(false)
    })
  }, [])

  const handleAddComponent = (typeId: string) => {
    const type = getComponentType(typeId)
    const newComponent: CanvasComponent = {
      id: `${typeId}-${Date.now()}`,
      type: typeId,
      position: {
        x: 240 + (components.length % 4) * 320,
        y: 1760 + Math.floor(components.length / 4) * 320,
      },
      status: "healthy",
      label: type?.name || typeId,
      subtitle: type?.slug || typeId,
      metricLabel: "Mode",
      metricValue: activeMode.toUpperCase(),
      latencyMs: 18,
    }
    setComponents((current) => [...current, newComponent])
    setSelectedId(newComponent.id)
    setLastAction(`Added ${type?.name || typeId} to canvas`)
  }

  const handleDrag = (id: string, x: number, y: number) => {
    setComponents((current) =>
      current.map((component) =>
        component.id === id ? { ...component, position: { x, y } } : component
      )
    )
  }

  const handleRemove = (id: string) => {
    setComponents((current) => current.filter((component) => component.id !== id))
    setSelectedId((current) => (current === id ? null : current))
    setLastAction(`Removed ${id} from canvas`)
  }

  const handleRefresh = () => {
    loadStudio("Live registry refreshed").catch((error) => {
      setErrorMessages([error instanceof Error ? error.message : "Refresh failed"])
      setBusy(false)
    })
  }

  const handleReleasePayout = async (payoutId: string) => {
    setReleasingPayoutId(payoutId)
    setLastAction(`Releasing ${payoutId.slice(0, 10)} for payout execution`)
    try {
      await api.releasePayout(payoutId, "Released from Archisynapse Studio")
      await loadStudio("Manual review payout released")
    } catch (error) {
      setErrorMessages([error instanceof Error ? error.message : "Payout release failed"])
      setLastAction("Manual review release failed")
      setBusy(false)
    } finally {
      setReleasingPayoutId(null)
    }
  }

  const handleSynthesize = async () => {
    setBusy(true)
    setLastAction("Running graph synthesis")
    try {
      const seeds = Array.from(
        new Set(
          components.flatMap((component) => COMPONENT_BLUEPRINT_MAP[component.type] || [])
        )
      )

      if (seeds.length === 0) {
        setRecommendations([])
        setLastAction("No blueprint seeds mapped from current canvas")
        setBusy(false)
        return
      }

      const response = await api.graphRecommendations(seeds, 6)
      setRecommendations(response.items)
      setLastAction(`Synthesized ${response.items.length} graph recommendations`)
    } catch (error) {
      setErrorMessages([error instanceof Error ? error.message : "Synthesis failed"])
      setLastAction("Graph synthesis failed")
    } finally {
      setBusy(false)
    }
  }

  const handleCompare = async () => {
    setBusy(true)
    setLastAction("Comparing canvas against blueprint registry")
    try {
      const query = components.map((component) => component.label || component.type).join(" ")
      const response = await api.matchBlueprints({ query, limit: 6 })
      setRecommendations(
        response.items.map((item) => ({
          blueprintId: item.blueprint.id,
          source: "semantic-compare",
          reason: `Semantic score ${item.score.toFixed(2)}`,
          confidence: item.score,
          blueprint: item.blueprint,
          sourceBlueprint: item.blueprint,
        }))
      )
      setLastAction(`Compared against ${response.items.length} registry blueprints`)
    } catch (error) {
      setErrorMessages([error instanceof Error ? error.message : "Compare failed"])
      setLastAction("Blueprint compare failed")
    } finally {
      setBusy(false)
    }
  }

  const signalScore = useMemo(() => {
    const successScore = dashboard?.metrics.success_rate_percent ?? 0
    const balanceScore = trialBalance?.isBalanced ? 100 : 65
    const graphScore = graphInfo ? clamp((graphInfo.edges / Math.max(graphInfo.nodes, 1)) * 40) : 0
    const payoutPenalty = Math.min(unpostedPayouts.length * 7, 30)
    const riskConfidence = riskSummary ? clamp(100 - riskSummary.averageRiskScore) : 65
    return clamp(Math.round(successScore * 0.35 + balanceScore * 0.25 + graphScore + riskConfidence * 0.15 - payoutPenalty))
  }, [dashboard, trialBalance, graphInfo, riskSummary, unpostedPayouts.length])

  const riskScore = useMemo(() => {
    if (riskSummary) {
      const decisionPressure = Math.min(
        riskSummary.blockedPayoutEvents * 12 +
        riskSummary.manualReviewEvents * 7 +
        riskSummary.delayedPayoutEvents * 4,
        60
      )
      return clamp(100 - riskSummary.averageRiskScore - decisionPressure)
    }

    const payoutRisk = Math.min(unpostedPayouts.length * 12, 60)
    const failedTransactions = dashboard?.status_breakdown.failed ?? 0
    const failedRisk = Math.min(failedTransactions * 4, 40)
    const balanceRisk = trialBalance?.isBalanced ? 0 : 25
    return clamp(100 - payoutRisk - failedRisk - balanceRisk)
  }, [dashboard, riskSummary, trialBalance, unpostedPayouts.length])

  const timeToRecovery = useMemo(() => {
    const response = dashboard?.metrics.average_response_time_ms ?? 20
    return clamp(100 - Math.min(response, 100))
  }, [dashboard])

  const bridgeVariant = errorMessages.length > 0 ? "destructive" : health?.status === "ok" ? "success" : "secondary"
  const bridgeStatus = errorMessages.length > 0 ? "Live Partial" : health?.status === "ok" ? "Bridge Active" : "Awaiting Signal"
  const environmentLabel = health?.status === "ok" ? "Production Mirror" : "Local Live Wiring"

  const topMetrics = [
    { label: "Live Volume", value: dashboard?.metrics.total_volume_formatted || "$0.00", tone: "text-emerald-400" },
    { label: "Success Rate", value: dashboard ? toPercent(dashboard.metrics.success_rate_percent) : "--", tone: "text-primary" },
    { label: "Risk Events", value: riskSummary ? String(riskSummary.totalEvents) : "--", tone: "text-amber-400" },
    { label: "Graph Nodes", value: graphInfo ? String(graphInfo.nodes) : "--", tone: "text-cyan-400" },
  ]

  const summaryMetrics = [
    { icon: BarChart3, label: "Impact Score", value: `${signalScore}/100`, color: "text-primary" },
    { icon: TrendingUp, label: "Revenue Surface", value: dashboard?.metrics.total_volume_formatted || "$0.00", color: "text-emerald-400" },
    {
      icon: Shield,
      label: "Risk State",
      value: `${riskScore}/100`,
      color: riskScore >= 80 ? "text-emerald-400" : "text-amber-400",
      sub: riskSummary
        ? `${riskSummary.blockedPayoutEvents} blocked • ${riskSummary.manualReviewEvents} manual review`
        : `${unpostedPayouts.length} payout exceptions`,
    },
    { icon: Clock, label: "Settlement Latency", value: `${dashboard?.metrics.average_response_time_ms ?? 0}ms`, color: "text-cyan-400" },
  ]

  const scoreBars = [
    { label: "Revenue Potential", value: clamp((dashboard?.metrics.total_transactions ?? 0) * 4, 0, 100), tone: "bg-cyan-400" },
    { label: "Risk Management", value: riskScore, tone: riskScore >= 80 ? "bg-emerald-400" : "bg-amber-400" },
    { label: "Time-to-Market", value: timeToRecovery, tone: "bg-primary" },
  ]

  const recommendationSignals = recommendations.length > 0
    ? recommendations.map((item) => ({
        title: item.blueprint.name,
        subtitle: item.reason || `${item.sourceBlueprint.name} -> ${item.blueprint.name}`,
      }))
    : blueprints.slice(0, 4).map((blueprint) => ({
        title: blueprint.name,
        subtitle: blueprint.tags.slice(0, 3).join(" • ") || blueprint.category,
      }))

  const systemSignals = [
    { label: "Bridge Health", value: health?.status || "offline" },
    { label: "Ledger Balance", value: trialBalance?.isBalanced ? "balanced" : "reconcile" },
    { label: "Unposted Payouts", value: String(unpostedPayouts.length) },
    { label: "Blocked Payouts", value: String(riskSummary?.blockedPayoutEvents ?? 0) },
    { label: "Manual Review", value: String(riskSummary?.manualReviewEvents ?? 0) },
    { label: "Held Queue", value: String(heldPayouts.length) },
    { label: "Recent Activity", value: String(dashboard?.recent_activity.length || 0) },
    { label: "Registry Assets", value: String(blueprints.length) },
  ]

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <TopBar
        environmentLabel={environmentLabel}
        statusLabel={bridgeStatus}
        statusVariant={bridgeVariant}
        metrics={topMetrics}
        busy={busy}
        onSynthesize={handleSynthesize}
        onCompare={handleCompare}
        onRefresh={handleRefresh}
      />

      <div className="flex h-[calc(100vh-80px)] min-h-0">
        <LeftSidebar onAddComponent={handleAddComponent} activeNav={activeNav} onNavChange={setActiveNav} />

        <section className="flex-1 min-w-0 relative flex flex-col">
          <div className="border-b border-white/5 px-6 py-4 bg-card/20 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="inline-flex items-center rounded-full border border-white/10 bg-black/30 p-1">
                {MODE_OPTIONS.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setActiveMode(mode.id)}
                    className={cn(
                      "px-10 py-3 rounded-full text-xs font-black uppercase tracking-[0.3em] transition-all",
                      activeMode === mode.id
                        ? "bg-primary text-black shadow-[0_0_40px_rgba(0,242,255,0.25)]"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={errorMessages.length > 0 ? "destructive" : "secondary"}>
                  {loading ? "Loading live system" : lastAction}
                </Badge>
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={busy}>
                  {busy ? <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Activity className="h-3.5 w-3.5 mr-2" />}
                  Sync Truth
                </Button>
              </div>
            </div>

            {errorMessages.length > 0 && (
              <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">Live data is partial</div>
                  <div className="text-destructive/80 text-xs mt-1">{errorMessages.join(" | ")}</div>
                </div>
              </div>
            )}
          </div>

          <ArchitectureCanvas
            components={components}
            edges={edges}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRemove={handleRemove}
            onDrag={handleDrag}
            onCanvasClick={() => setSelectedId(null)}
          />
        </section>

        <RightAnalytics
          engineLabel="Bidirectional Engine"
          bridgeStatus={bridgeStatus}
          bridgeVariant={bridgeVariant}
          summaryMetrics={summaryMetrics}
          scoreBars={scoreBars}
          monetizationPotential={dashboard?.metrics.total_volume_formatted || "$0.00"}
          recommendations={recommendationSignals}
          heldPayouts={heldPayouts}
          releasingPayoutId={releasingPayoutId}
          onReleasePayout={handleReleasePayout}
          systemSignals={systemSignals}
        />
      </div>
    </main>
  )
}
