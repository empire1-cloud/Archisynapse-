"use client"

import { useState, useCallback } from "react"
import { v4 as uuidv4 } from "uuid"
import { TopBar } from "@/components/TopBar"
import { LeftSidebar } from "@/components/LeftSidebar"
import { ArchitectureCanvas } from "@/components/ArchitectureCanvas"
import { RightAnalytics } from "@/components/RightAnalytics"
import type { CanvasComponent } from "@/components/ArchitectureNode"

const DEFAULT_COMPONENTS: CanvasComponent[] = [
  { id: "c1", type: "lyrica-rail", position: { x: 80, y: 100 }, status: "healthy" },
  { id: "c2", type: "payment-processor", position: { x: 520, y: 100 }, status: "healthy" },
  { id: "c3", type: "auth-provider", position: { x: 80, y: 320 }, status: "healthy" },
  { id: "c4", type: "fraud-detection", position: { x: 520, y: 320 }, status: "healthy" },
  { id: "c5", type: "sla113-os", position: { x: 300, y: 540 }, status: "healthy" },
]

const DEFAULT_EDGES = [
  { id: "e1", sourceId: "c1", targetId: "c2" },
  { id: "e2", sourceId: "c3", targetId: "c1" },
  { id: "e3", sourceId: "c3", targetId: "c4" },
  { id: "e4", sourceId: "c4", targetId: "c2" },
  { id: "e5", sourceId: "c1", targetId: "c5" },
  { id: "e6", sourceId: "c5", targetId: "c2" },
]

export default function StudioPage() {
  const [components, setComponents] = useState<CanvasComponent[]>(DEFAULT_COMPONENTS)
  const [edges] = useState(DEFAULT_EDGES)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeNav, setActiveNav] = useState("registry")

  const handleAddComponent = useCallback((typeId: string) => {
    const offset = components.length * 30
    const newComp: CanvasComponent = {
      id: `c_${uuidv4().slice(0, 8)}`,
      type: typeId,
      position: { x: 200 + offset, y: 200 + offset },
      status: "healthy",
    }
    setComponents(prev => [...prev, newComp])
  }, [components.length])

  const handleSelect = useCallback((id: string | null) => setSelectedId(id), [])
  const handleRemove = useCallback((id: string) => {
    setComponents(prev => prev.filter(c => c.id !== id))
    setSelectedId(null)
  }, [])
  const handleDrag = useCallback((id: string, x: number, y: number) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, position: { x, y } } : c))
  }, [])
  const handleCanvasClick = useCallback(() => setSelectedId(null), [])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <TopBar />
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        <LeftSidebar onAddComponent={handleAddComponent} activeNav={activeNav} onNavChange={setActiveNav} />
        <ArchitectureCanvas
          components={components} edges={edges}
          selectedId={selectedId} onSelect={handleSelect}
          onRemove={handleRemove} onDrag={handleDrag}
          onCanvasClick={handleCanvasClick}
        />
        <RightAnalytics />
      </div>
    </div>
  )
}
