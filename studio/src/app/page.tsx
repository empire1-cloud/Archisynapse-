"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { Blueprint, ArchComponent, ComponentType, MarketEvent } from "@/types/architecture"
import { Header } from "@/components/architecture/Header"
import { ComponentLibrary } from "@/components/architecture/ComponentLibrary"
import { CanvasNode } from "@/components/architecture/CanvasNode"
import { ConnectionsLayer } from "@/components/architecture/ConnectionsLayer"
import { AIAnalysisPanel } from "@/components/architecture/AIAnalysisPanel"
import { DependencyAnalysisPanel } from "@/components/architecture/DependencyAnalysisPanel"
import { BusinessROIInspector } from "@/components/architecture/BusinessROIInspector"
import { SynapseInsights } from "@/components/architecture/SynapseInsights"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { generateStrategyBlueprint } from "@/ai/flows/strategy-to-blueprint-flow"
import { generateExecutiveBriefing, BriefingOutput } from "@/ai/flows/executive-briefing-flow"
import { compareStrategies, ComparisonOutput } from "@/ai/flows/strategy-comparison-flow"
import { generateMarketEvent } from "@/ai/flows/market-sentinel-flow"
import {
  Sparkles, Loader2, FileText, Scale, Play, Square, Flame, Radar,
  ChevronLeft, ChevronRight, Layout, AlertCircle
} from "lucide-react"

function createDefaultBlueprint(): Blueprint {
  return {
    id: "bp-1",
    name: "Fintech Core Platform",
    version: "2.0.0",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    components: [
      { id: "c1", name: "Mobile App", type: "user-interface", description: "Customer facing mobile banking app", config: {}, position: { x: 250, y: 150 }, roiScore: 80, riskScore: 20, status: "healthy", latency: 45, throughput: 1200, techDebtScore: 10 },
      { id: "c2", name: "Edge Gateway", type: "gateway", description: "Global entry point with security filtering", config: {}, position: { x: 550, y: 150 }, roiScore: 60, riskScore: 10, status: "healthy", latency: 5, throughput: 5000, techDebtScore: 5 },
      { id: "c3", name: "Payment Service", type: "payment-processor", description: "PCI-compliant card processing", config: {}, position: { x: 850, y: 150 }, roiScore: 95, riskScore: 40, status: "healthy", latency: 120, throughput: 450, techDebtScore: 25 },
      { id: "c4", name: "Auth Service", type: "auth-provider", description: "KYC/AML identity verification", config: {}, position: { x: 250, y: 400 }, roiScore: 70, riskScore: 15, status: "healthy", latency: 30, throughput: 800, techDebtScore: 8 },
      { id: "c5", name: "Fraud Detection", type: "fraud-detection", description: "ML-based fraud scoring", config: {}, position: { x: 550, y: 400 }, roiScore: 85, riskScore: 25, status: "healthy", latency: 60, throughput: 300, techDebtScore: 15 },
    ],
    dependencies: [
      { id: "d1", sourceId: "c1", targetId: "c2", type: "sync" },
      { id: "d2", sourceId: "c2", targetId: "c3", type: "sync" },
      { id: "d3", sourceId: "c4", targetId: "c2", type: "sync" },
      { id: "d4", sourceId: "c5", targetId: "c3", type: "async" },
      { id: "d5", sourceId: "c4", targetId: "c1", type: "sync" },
    ],
  }
}

export default function ArchisynapseApp() {
  const [mounted, setMounted] = useState(false)
  const [blueprint, setBlueprint] = useState<Blueprint>(createDefaultBlueprint)
  const [vaultedStrategies, setVaultedStrategies] = useState<Blueprint[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [heatmapMode, setHeatmapMode] = useState<"none" | "roi" | "risk" | "quality">("none")
  const [totalRevenue, setTotalRevenue] = useState(0)

  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)

  const [strategyModalOpen, setStrategyModalOpen] = useState(false)
  const [briefingModalOpen, setBriefingModalOpen] = useState(false)
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false)
  const [marketEventModalOpen, setMarketEventModalOpen] = useState(false)

  const [strategyGoal, setStrategyGoal] = useState("")
  const [generating, setGenerating] = useState(false)
  const [briefing, setBriefing] = useState<BriefingOutput | null>(null)
  const [generatingBriefing, setGeneratingBriefing] = useState(false)
  const [comparison, setComparison] = useState<ComparisonOutput | null>(null)
  const [comparing, setComparing] = useState(false)
  const [scanningMarket, setScanningMarket] = useState(false)
  const [activeMarketEvent, setActiveMarketEvent] = useState<MarketEvent | null>(null)

  const { toast } = useToast()

  useEffect(() => { setMounted(true) }, [])

  const selectedComponent = blueprint.components.find(c => c.id === selectedId)

  const governanceAnalysis = useMemo(() => {
    let gaps = 0
    const gapComponentIds = new Set<string>()
    const types = blueprint.components.map(c => c.type)

    if (types.includes("payment-processor") && !types.includes("fraud-detection")) {
      blueprint.components.filter(c => c.type === "payment-processor").forEach(c => gapComponentIds.add(c.id)); gaps++
    }
    if (types.includes("database") && !types.includes("auth-provider")) {
      blueprint.components.filter(c => c.type === "database").forEach(c => gapComponentIds.add(c.id)); gaps++
    }
    if (types.includes("user-interface") && !types.includes("gateway")) {
      blueprint.components.filter(c => c.type === "user-interface").forEach(c => gapComponentIds.add(c.id)); gaps++
    }
    return { totalGaps: gaps, gapComponentIds }
  }, [blueprint.components])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isSimulating && mounted) {
      interval = setInterval(() => {
        const inc = blueprint.components.reduce((acc, c) => {
          if (c.status !== "healthy") return acc
          return acc + ((c.roiScore || 50) * (c.throughput / 10000))
        }, 0)
        setTotalRevenue(prev => prev + inc)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isSimulating, blueprint.components, mounted])

  const globalStats = useMemo(() => {
    const totalRoi = blueprint.components.reduce((acc, c) => acc + (c.roiScore || 50), 0)
    const totalRisk = blueprint.components.reduce((acc, c) => acc + (c.riskScore || 20), 0)
    const count = blueprint.components.length || 1
    return {
      roi: Math.round(totalRoi / count),
      security: 100 - Math.round(totalRisk / count),
      efficiency: 74,
      governanceGaps: governanceAnalysis.totalGaps,
      revenue: totalRevenue,
    }
  }, [blueprint.components, governanceAnalysis, totalRevenue])

  const handleAddComponent = useCallback((type: ComponentType) => {
    const offset = blueprint.components.length * 30
    const newComp: ArchComponent = {
      id: `c_${Date.now()}`,
      name: type.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
      type,
      description: `A new ${type} component`,
      config: {},
      position: { x: 400 + offset, y: 300 + offset },
      roiScore: Math.floor(40 + Math.random() * 50),
      riskScore: Math.floor(10 + Math.random() * 40),
      status: "healthy",
      latency: Math.floor(10 + Math.random() * 100),
      throughput: Math.floor(100 + Math.random() * 2000),
      techDebtScore: Math.floor(Math.random() * 30),
    }
    setBlueprint(prev => ({ ...prev, components: [...prev.components, newComp] }))
  }, [blueprint.components.length])

  const handleDrag = useCallback((id: string, x: number, y: number) => {
    setBlueprint(prev => ({
      ...prev,
      components: prev.components.map(c => c.id === id ? { ...c, position: { x, y } } : c),
    }))
  }, [])

  const handleRemove = useCallback((id: string) => {
    setBlueprint(prev => ({
      ...prev,
      components: prev.components.filter(c => c.id !== id),
      dependencies: prev.dependencies.filter(d => d.sourceId !== id && d.targetId !== id),
    }))
    if (selectedId === id) setSelectedId(null)
  }, [selectedId])

  const handleSelect = useCallback((id: string | null) => setSelectedId(id), [])

  const toggleChaos = () => {
    if (blueprint.components.length === 0) return
    const idx = Math.floor(Math.random() * blueprint.components.length)
    const target = blueprint.components[idx]
    setBlueprint(prev => ({
      ...prev,
      components: prev.components.map(c =>
        c.id === target.id ? { ...c, status: c.status === "failed" ? "healthy" : "failed" } : c
      ),
    }))
    toast({ variant: "destructive", title: "Resilience Test", description: `Injected failure into ${target.name}` })
  }

  const handleGenerateFromStrategy = async () => {
    if (!strategyGoal) return
    setGenerating(true)
    try {
      const result = await generateStrategyBlueprint({ goal: strategyGoal })
      const newBp: Blueprint = {
        id: `bp-${Date.now()}`,
        name: result.name,
        version: "1.0.0",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        components: result.components.map(c => ({
          ...c, config: {}, status: "healthy" as const,
          latency: 20, throughput: 1000, techDebtScore: 5,
        })),
        dependencies: result.dependencies.map(d => ({ ...d, id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })),
      }
      setBlueprint(newBp)
      setVaultedStrategies(prev => [...prev, newBp])
      setStrategyModalOpen(false)
      toast({ title: "Strategy Synthesized", description: result.name })
    } catch {
      toast({ variant: "destructive", title: "Synthesis Failed" })
    } finally {
      setGenerating(false)
    }
  }

  const handleCompare = async () => {
    if (vaultedStrategies.length < 1) {
      toast({ title: "Insufficient Scenarios", description: "Vault at least one design first." })
      return
    }
    setComparing(true)
    setComparisonModalOpen(true)
    try {
      const baseline = vaultedStrategies[0]
      const result = await compareStrategies({
        baseline: { name: baseline.name, components: baseline.components.map(c => ({ name: c.name, type: c.type, roiScore: c.roiScore, riskScore: c.riskScore })) },
        alternative: { name: blueprint.name, components: blueprint.components.map(c => ({ name: c.name, type: c.type, roiScore: c.roiScore, riskScore: c.riskScore })) },
      })
      setComparison(result)
    } catch {
      toast({ variant: "destructive", title: "Analysis Failed" })
    } finally {
      setComparing(false)
    }
  }

  const runMarketSentinel = async () => {
    setScanningMarket(true)
    try {
      const summary = blueprint.components.map(c => `${c.name} (${c.type})`).join(", ")
      const event = await generateMarketEvent(summary)
      setActiveMarketEvent(event as MarketEvent)
      setMarketEventModalOpen(true)
      setBlueprint(prev => ({
        ...prev,
        components: prev.components.map(c => ({ ...c, isHighlighted: (event as MarketEvent).affectedTypes.includes(c.type) })),
      }))
    } catch {
      toast({ variant: "destructive", title: "Sentinel Offline" })
    } finally {
      setScanningMarket(false)
    }
  }

  const handleBriefing = async () => {
    setGeneratingBriefing(true)
    setBriefingModalOpen(true)
    try {
      const res = await generateExecutiveBriefing({
        blueprintName: blueprint.name,
        components: blueprint.components.map(c => ({ name: c.name, type: c.type, roiScore: c.roiScore, riskScore: c.riskScore })),
        businessGoal: strategyGoal || "Strategic Market Growth",
      })
      setBriefing(res)
    } catch {
      toast({ variant: "destructive", title: "Briefing Failed" })
    } finally {
      setGeneratingBriefing(false)
    }
  }

  if (!mounted) return null

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground selection:bg-primary/30">
      <Header
        blueprintName={blueprint.name}
        onSave={() => {
          setVaultedStrategies(prev => [...prev, blueprint])
          toast({ title: "Design Vaulted" })
        }}
        onExport={() => {}}
        onGenerate={() => setStrategyModalOpen(true)}
        onBriefing={handleBriefing}
        onCompare={handleCompare}
        stats={globalStats}
        isGeneratingBriefing={generatingBriefing}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar */}
        <aside className={cn(
          "glass-panel flex flex-col h-full z-20 transition-all duration-500 ease-in-out relative border-r border-white/5 bg-background/40 backdrop-blur-3xl",
          leftPanelOpen ? "w-80" : "w-0 overflow-hidden"
        )}>
          {leftPanelOpen && (
            <Tabs defaultValue="registry" className="flex-1 flex flex-col">
              <TabsList className="w-full justify-start rounded-none border-b border-white/5 h-14 bg-transparent px-6 gap-8">
                <TabsTrigger value="registry" className="h-14 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 text-[10px] font-bold uppercase tracking-[0.2em] transition-all opacity-60 data-[state=active]:opacity-100">Registry</TabsTrigger>
                <TabsTrigger value="synapse" className="h-14 rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent px-0 text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex gap-2 opacity-60 data-[state=active]:opacity-100">
                  <Sparkles size={12} className="text-accent" /> Synapse
                </TabsTrigger>
                <TabsTrigger value="inspector" className="h-14 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 text-[10px] font-bold uppercase tracking-[0.2em] transition-all disabled:opacity-30 opacity-60 data-[state=active]:opacity-100" disabled={!selectedId}>
                  Intelligence
                </TabsTrigger>
              </TabsList>
              <div className="flex-1 overflow-hidden">
                <TabsContent value="registry" className="h-full m-0 p-0">
                  <ComponentLibrary onAddComponent={handleAddComponent} />
                </TabsContent>
                <TabsContent value="synapse" className="h-full m-0 p-4">
                  <ScrollArea className="h-full">
                    <SynapseInsights blueprint={blueprint} onAddComponent={handleAddComponent} onUpdateBlueprint={setBlueprint} />
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="inspector" className="h-full m-0 p-4">
                  <ScrollArea className="h-full">
                    {selectedComponent ? (
                      <BusinessROIInspector component={selectedComponent} />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center p-12 opacity-10">
                        <Layout size={40} className="mb-4" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Select Asset</p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </div>
            </Tabs>
          )}
          <Button variant="ghost" size="icon" className="absolute -right-5 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full glass-panel z-30 border border-white/5 bg-background/60 backdrop-blur-xl group hover:bg-white/5" onClick={() => setLeftPanelOpen(!leftPanelOpen)}>
            {leftPanelOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </Button>
        </aside>

        {/* Main Canvas */}
        <main className="flex-1 relative overflow-hidden canvas-grid">
          <div className="absolute inset-0 overflow-auto scrollbar-hide" onClick={() => handleSelect(null)}>
            <div className="relative min-w-[3000px] min-h-[3000px]">
              <ConnectionsLayer components={blueprint.components} dependencies={blueprint.dependencies} isSimulating={isSimulating} />
              {blueprint.components.map(comp => (
                <CanvasNode
                  key={comp.id}
                  component={{ ...comp, hasGovernanceGap: governanceAnalysis.gapComponentIds.has(comp.id) }}
                  isSelected={selectedId === comp.id}
                  onSelect={handleSelect}
                  onRemove={handleRemove}
                  onDrag={handleDrag}
                  isSimulating={isSimulating}
                  heatmapMode={heatmapMode}
                />
              ))}
            </div>
          </div>

          {/* Floating Heatmap Controls */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 glass-panel rounded-full p-1.5 z-30 shadow-2xl ring-1 ring-white/10 bg-background/60 backdrop-blur-2xl">
            <Button variant={heatmapMode === "none" ? "default" : "ghost"} size="sm" className="h-8 rounded-full text-[10px] font-bold uppercase tracking-widest px-6 btn-high-end" onClick={() => setHeatmapMode("none")}>Draft</Button>
            <div className="w-px h-4 bg-white/10" />
            <Button variant="ghost" size="sm" className={cn("h-8 rounded-full text-[10px] font-bold uppercase tracking-widest px-6 btn-high-end", heatmapMode === "roi" && "bg-emerald-500/20 text-emerald-400")} onClick={() => setHeatmapMode("roi")}>ROI</Button>
            <Button variant="ghost" size="sm" className={cn("h-8 rounded-full text-[10px] font-bold uppercase tracking-widest px-6 btn-high-end", heatmapMode === "risk" && "bg-orange-500/20 text-orange-400")} onClick={() => setHeatmapMode("risk")}>Risk</Button>
            <Button variant="ghost" size="sm" className={cn("h-8 rounded-full text-[10px] font-bold uppercase tracking-widest px-6 btn-high-end", heatmapMode === "quality" && "bg-blue-500/20 text-blue-400")} onClick={() => setHeatmapMode("quality")}>Debt</Button>
          </div>

          {/* Bottom Toolbar */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 glass-panel rounded-3xl px-8 py-3.5 flex items-center gap-8 z-30 shadow-[0_0_80px_rgba(0,0,0,0.8)] ring-1 ring-white/5 bg-background/60 backdrop-blur-2xl">
            <div className="flex items-center gap-4 border-r pr-8 border-white/10">
              <div className={cn("w-2.5 h-2.5 rounded-full", isSimulating ? "bg-accent shadow-[0_0_15px_rgba(0,255,255,0.8)] animate-pulse" : "bg-muted")} />
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] leading-none mb-1">Engine</span>
                <span className={cn("text-xs font-bold tracking-tight", isSimulating ? "text-accent" : "text-muted-foreground")}>{isSimulating ? "SIM ACTIVE" : "STANDBY"}</span>
              </div>
            </div>
            {isSimulating && (
              <div className="flex flex-col min-w-[120px]">
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] leading-none mb-1">Yield</span>
                <span className="text-sm font-mono text-emerald-400 font-bold tracking-tighter">${totalRevenue.toFixed(0)}</span>
              </div>
            )}
            <div className="flex gap-1.5">
              <Button size="icon" variant="ghost" onClick={() => setIsSimulating(!isSimulating)} className={cn("rounded-full h-10 w-10", isSimulating ? "bg-accent/10 text-accent" : "hover:bg-white/5")}>
                {isSimulating ? <Square size={16} /> : <Play size={16} />}
              </Button>
              <Button size="icon" variant="ghost" onClick={toggleChaos} className="rounded-full h-10 w-10 hover:bg-orange-500/10 hover:text-orange-400 transition-all">
                <Flame size={16} />
              </Button>
              <Button size="icon" variant="ghost" onClick={runMarketSentinel} disabled={scanningMarket} className="rounded-full h-10 w-10 hover:bg-accent/10 hover:text-accent transition-all">
                {scanningMarket ? <Loader2 size={16} className="animate-spin" /> : <Radar size={16} />}
              </Button>
            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className={cn(
          "glass-panel flex flex-col h-full z-20 transition-all duration-500 ease-in-out relative border-l border-white/5 bg-background/40 backdrop-blur-3xl",
          rightPanelOpen ? "w-96" : "w-0 overflow-hidden"
        )}>
          <Button variant="ghost" size="icon" className="absolute -left-5 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full glass-panel z-30 border border-white/5 bg-background/60 backdrop-blur-xl hover:bg-white/5" onClick={() => setRightPanelOpen(!rightPanelOpen)}>
            {rightPanelOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </Button>
          {rightPanelOpen && (
            <Tabs defaultValue="insights" className="flex flex-col h-full">
              <TabsList className="w-full justify-start rounded-none border-b border-white/5 bg-transparent h-14 px-8 gap-8">
                <TabsTrigger value="insights" className="h-14 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 text-[10px] font-bold uppercase tracking-[0.2em] transition-all opacity-60 data-[state=active]:opacity-100">Strategic Audit</TabsTrigger>
                <TabsTrigger value="impact" className="h-14 rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent px-0 text-[10px] font-bold uppercase tracking-[0.2em] transition-all opacity-60 data-[state=active]:opacity-100">Risk Analysis</TabsTrigger>
              </TabsList>
              <TabsContent value="insights" className="flex-1 m-0 p-0 overflow-hidden">
                <AIAnalysisPanel blueprint={blueprint} />
              </TabsContent>
              <TabsContent value="impact" className="flex-1 m-0 p-0 overflow-hidden">
                <DependencyAnalysisPanel blueprint={blueprint} />
              </TabsContent>
            </Tabs>
          )}
        </aside>
      </div>

      {/* Strategy Synthesis Modal */}
      <Dialog open={strategyModalOpen} onOpenChange={setStrategyModalOpen}>
        <DialogContent className="glass-panel bg-background/80 backdrop-blur-3xl border-white/10">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl">Strategic Synthesis</DialogTitle>
            <DialogDescription className="text-muted-foreground">Define your market objective to generate a high-yield technical blueprint.</DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <Textarea
              placeholder="e.g., Build a hyper-scale neobank supporting 1M+ active users with PCI-compliant real-time settling."
              value={strategyGoal}
              onChange={e => setStrategyGoal(e.target.value)}
              className="min-h-[140px] rounded-2xl bg-white/5 border-white/10 focus:ring-primary/40 focus:border-primary/40"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStrategyModalOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleGenerateFromStrategy} disabled={generating || !strategyGoal} className="rounded-xl bg-primary px-8">
              {generating ? <Loader2 className="animate-spin mr-2" size={18} /> : "Synthesize Architecture"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Board Briefing Modal */}
      <Dialog open={briefingModalOpen} onOpenChange={setBriefingModalOpen}>
        <DialogContent className="glass-panel bg-background/80 backdrop-blur-3xl border-white/10 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl flex items-center gap-3">
              <FileText size={24} className="text-primary" /> Board Briefing
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 max-h-[60vh] overflow-y-auto space-y-6">
            {generatingBriefing ? (
              <div className="flex items-center justify-center py-12"><Loader2 size={32} className="animate-spin text-primary" /></div>
            ) : briefing ? (
              <>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Executive Summary</h4>
                  <p className="text-sm leading-relaxed">{briefing.executiveSummary}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">ROI Projection</span>
                    <p className="text-sm mt-1">{briefing.roiProjection}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
                    <span className="text-[9px] font-black uppercase tracking-widest text-orange-400">Risk Mitigation</span>
                    <p className="text-sm mt-1">{briefing.riskMitigation}</p>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Short-Term Impact</h4>
                  <p className="text-sm text-muted-foreground">{briefing.shortTermImpact}</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Long-Term Impact</h4>
                  <p className="text-sm text-muted-foreground">{briefing.longTermImpact}</p>
                </div>
              </>
            ) : (
              <p className="text-center text-muted-foreground">Could not generate briefing.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Comparison Modal */}
      <Dialog open={comparisonModalOpen} onOpenChange={setComparisonModalOpen}>
        <DialogContent className="glass-panel bg-background/80 backdrop-blur-3xl border-white/10 max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl flex items-center gap-3">
              <Scale size={24} className="text-primary" /> Strategy Comparison
            </DialogTitle>
          </DialogHeader>
          <div className="py-6">
            {comparing ? (
              <div className="flex items-center justify-center py-12"><Loader2 size={32} className="animate-spin text-primary" /></div>
            ) : comparison ? (
              <div className="space-y-6">
                <div className="text-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Winner</span>
                  <p className="text-2xl font-heading font-bold text-emerald-400 mt-1">{comparison.winner}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">ROI Delta</span>
                    <p className="text-xl font-bold font-heading text-emerald-400 mt-1">{comparison.roiDelta}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Risk Delta</span>
                    <p className="text-xl font-bold font-heading text-orange-400 mt-1">{comparison.riskDelta}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{comparison.reasoning}</p>
              </div>
            ) : (
              <p className="text-center text-muted-foreground">Could not complete comparison.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Market Sentinel Modal */}
      <Dialog open={marketEventModalOpen} onOpenChange={(open) => {
        setMarketEventModalOpen(open)
        if (!open) setBlueprint(prev => ({ ...prev, components: prev.components.map(c => ({ ...c, isHighlighted: false })) }))
      }}>
        <DialogContent className="glass-panel border-accent/20 bg-background/80 backdrop-blur-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-accent text-xl font-headline tracking-tight">
              <Radar size={24} className="animate-pulse" /> Strategic Market Alert
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <div className="space-y-2">
              <h4 className="text-lg font-bold text-foreground">{activeMarketEvent?.title}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{activeMarketEvent?.description}</p>
            </div>
            <div className="p-4 bg-accent/5 rounded-2xl border border-accent/10">
              <h5 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 text-accent/80">Exposed Infrastructure</h5>
              <div className="flex flex-wrap gap-2">
                {activeMarketEvent?.affectedTypes.map(type => (
                  <Badge key={type} variant="outline" className="text-[9px] uppercase tracking-wider py-1 px-3 bg-black/40 border-accent/20 text-accent">{type}</Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setMarketEventModalOpen(false)} className="w-full rounded-xl bg-accent text-black hover:bg-accent/90">Acknowledge Impact</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
