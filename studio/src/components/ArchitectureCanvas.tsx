"use client"

import { ArchitectureNode, type CanvasComponent } from "./ArchitectureNode"
import { ArchitectureEdges } from "./ArchitectureEdges"

interface ArchitectureCanvasProps {
  components: CanvasComponent[]
  edges: Array<{ id: string; sourceId: string; targetId: string; status?: string }>
  selectedId: string | null
  onSelect: (id: string | null) => void
  onRemove: (id: string) => void
  onDrag: (id: string, x: number, y: number) => void
  onCanvasClick: () => void
}

export function ArchitectureCanvas({ components, edges, selectedId, onSelect, onRemove, onDrag, onCanvasClick }: ArchitectureCanvasProps) {
  return (
    <div className="flex-1 relative overflow-hidden canvas-grid min-h-0" onClick={onCanvasClick}>
      <div className="relative w-full h-full bg-background overflow-hidden cursor-crosshair rounded-none border-0">
        <div className="relative min-w-[3000px] min-h-[3000px] pb-[800px]" onClick={e => e.stopPropagation()}>
          <ArchitectureEdges edges={edges} nodes={components} />
          {components.map(comp => (
            <ArchitectureNode key={comp.id} component={comp} isSelected={selectedId === comp.id}
              onSelect={onSelect} onRemove={onRemove} onDrag={onDrag} />
          ))}
          {components.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-4xl font-heading font-black text-white/5 uppercase tracking-[0.3em]">Architecture Canvas</div>
                <p className="text-muted-foreground text-sm mt-4">Add components from the sidebar to design your stack</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
