"use client"

import { useState, useCallback } from "react"
import { v4 as uuidv4 } from "uuid"
import { TopToolbar } from "@/components/TopToolbar"
import { BottomControls } from "@/components/BottomControls"
import { ArchitectureCanvas } from "@/components/ArchitectureCanvas"
import type { CanvasComponent } from "@/components/ArchitectureNode"
import { SemanticSearchPanel } from "@/components/SemanticSearchPanel"
import { CopilotPanel } from "@/components/CopilotPanel"
import { BlueprintAnalytics } from "@/components/BlueprintAnalytics"
import { useFirebase } from "@/components/FirebaseProvider"
import { COMPONENT_TYPES } from "@/components/ComponentRegistry"
import { api } from "@/lib/api"

const DEFAULT_COMPONENTS: CanvasComponent[] = [
  { id: "c1", type: "lyrica-rail", position: { x: 60, y: 80 }, roiScore: 90, riskScore: 5, status: "healthy" },
  { id: "c2", type: "payment-processor", position: { x: 560, y: 80 }, roiScore: 98, riskScore: 2, status: "healthy" },
  { id: "c3", type: "auth-provider", position: { x: 60, y: 360 }, roiScore: 85, riskScore: 8, status: "healthy" },
  { id: "c4", type: "fraud-detection", position: { x: 560, y: 360 }, roiScore: 72, riskScore: 15, status: "healthy" },
]

const DEFAULT_EDGES = [
  { id: "e1", sourceId: "c1", targetId: "c2", latency: 12, throughput: 1e6, status: "healthy" as const },
  { id: "e2", sourceId: "c3", targetId: "c1", latency: 8, throughput: 500000, status: "healthy" as const },
  { id: "e3", sourceId: "c3", targetId: "c4", latency: 5, throughput: 300000, status: "healthy" as const },
  { id: "e4", sourceId: "c4", targetId: "c2", latency: 10, throughput: 750000, status: "healthy" as const },
]

export default function StudioPage() {
  const { user } = useFirebase()

  const [activeTab, setActiveTab] = useState("stack")
  const [components, setComponents] = useState<CanvasComponent[]>(DEFAULT_COMPONENTS)
  const [edges] = useState(DEFAULT_EDGES)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [simulating, setSimulating] = useState(false)

  const handleSelect = useCallback((id: string | null) => setSelectedId(id), [])

  const handleRemove = useCallback((id: string) => {
    setComponents(prev => prev.filter(c => c.id !== id))
    setSelectedId(null)
  }, [])

  const handleDrag = useCallback((id: string, x: number, y: number) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, position: { x, y } } : c))
  }, [])

  const handleAddComponent = useCallback((type: string, _name: string) => {
    const def = COMPONENT_TYPES.find(t => t.id === type || t.name === _name)
    const componentType = def?.id || type
    const newComp: CanvasComponent = {
      id: `c_${uuidv4().slice(0, 8)}`,
      type: componentType,
      position: { x: 300 + components.length * 40, y: 200 + components.length * 30 },
      roiScore: Math.floor(Math.random() * 40) + 60,
      riskScore: Math.floor(Math.random() * 30) + 5,
      status: "healthy",
    }
    setComponents(prev => [...prev, newComp])
  }, [components.length])

  const handleSave = useCallback(async () => {
    setSaving(true)
    await new Promise(r => setTimeout(r, 800))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [])

  const handleDeploy = useCallback(async () => {
    setDeploying(true)
    await new Promise(r => setTimeout(r, 1500))
    setDeploying(false)
  }, [])

  const handleSimulate = useCallback(async () => {
    setSimulating(true)
    const randomIndex = Math.floor(Math.random() * components.length)
    setComponents(prev => prev.map((c, i) =>
      i === randomIndex ? { ...c, status: "failed" as const } : c
    ))
    await new Promise(r => setTimeout(r, 2000))
    setComponents(prev => prev.map(c => ({ ...c, status: "healthy" as const })))
    setSimulating(false)
  }, [components])

  const handleHarden = useCallback(() => {
    setComponents(prev => prev.map(c => ({
      ...c,
      riskScore: Math.max(0, (c.riskScore || 10) - 5),
      roiScore: Math.min(100, (c.roiScore || 80) + 3),
    })))
  }, [])

  const handleOptimize = useCallback(() => {
    setComponents(prev => prev.map(c => ({
      ...c,
      roiScore: Math.min(100, (c.roiScore || 80) + 8),
      riskScore: Math.max(0, (c.riskScore || 10) - 2),
    })))
  }, [])

  const handleCanvasClick = useCallback(() => setSelectedId(null), [])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <TopToolbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        blueprintName="Archisynapse Sovereign Core"
        onSave={handleSave}
        saving={saving}
        saved={saved}
        stats={{ components: components.length, edges: edges.length }}
      />

      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {activeTab === "stack" && (
          <>
            <ArchitectureCanvas
              components={components}
              edges={edges}
              selectedId={selectedId}
              onSelect={handleSelect}
              onRemove={handleRemove}
              onDrag={handleDrag}
              onCanvasClick={handleCanvasClick}
            />
            <BottomControls
              onDeploy={handleDeploy}
              onSimulate={handleSimulate}
              onHarden={handleHarden}
              onOptimize={handleOptimize}
              deploying={deploying}
              simulating={simulating}
            />
          </>
        )}

        {activeTab === "synapse" && (
          <div className="flex-1 flex">
            <ArchitectureCanvas
              components={components}
              edges={edges}
              selectedId={selectedId}
              onSelect={handleSelect}
              onRemove={handleRemove}
              onDrag={handleDrag}
              onCanvasClick={handleCanvasClick}
            />
          </div>
        )}

        {activeTab === "semantic" && (
          <div className="flex-1 flex">
            <ArchitectureCanvas
              components={components}
              edges={edges}
              selectedId={selectedId}
              onSelect={handleSelect}
              onRemove={handleRemove}
              onDrag={handleDrag}
              onCanvasClick={handleCanvasClick}
            />
            <div className="w-96 border-l border-white/5 bg-card/30 backdrop-blur-2xl overflow-y-auto">
              <SemanticSearchPanel onAddComponent={handleAddComponent} />
            </div>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="flex-1 flex">
            <ArchitectureCanvas
              components={components}
              edges={edges}
              selectedId={selectedId}
              onSelect={handleSelect}
              onRemove={handleRemove}
              onDrag={handleDrag}
              onCanvasClick={handleCanvasClick}
            />
            <div className="w-96 border-l border-white/5 bg-card/30 backdrop-blur-2xl overflow-y-auto">
              <BlueprintAnalytics />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
