"use client"

import { useCallback, useRef } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { getComponentType, COLOR_MAP, CATEGORY_COLORS } from "@/components/ComponentRegistry"
import type { ComponentType } from "@/components/ComponentRegistry"

export interface CanvasComponent {
  id: string
  type: string
  position: { x: number; y: number }
  roiScore?: number
  riskScore?: number
  status?: "healthy" | "standby" | "failed"
}

interface ArchitectureNodeProps {
  component: CanvasComponent
  isSelected: boolean
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onDrag: (id: string, x: number, y: number) => void
}

export function ArchitectureNode({ component, isSelected, onSelect, onRemove, onDrag }: ArchitectureNodeProps) {
  const dragRef = useRef({ startX: 0, startY: 0, nodeX: 0, nodeY: 0, dragging: false })
  const def = getComponentType(component.type)
  const Icon = def?.icon

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      nodeX: component.position.x,
      nodeY: component.position.y,
      dragging: false,
    }

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.dragging = true
      if (dragRef.current.dragging) {
        onDrag(component.id, dragRef.current.nodeX + dx, dragRef.current.nodeY + dy)
      }
    }
    const handleMouseUp = () => {
      if (!dragRef.current.dragging) onSelect(component.id)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }, [component, onSelect, onDrag])

  const statusColor = component.status === "failed"
    ? "border-destructive/80 ring-8 ring-destructive/80 bg-destructive/30"
    : component.status === "standby"
    ? "border-amber-500/50 ring-4 ring-amber-500/40"
    : isSelected
    ? "ring-[12px] ring-accent/60 border-accent/80 shadow-[0_0_200px_rgba(0,242,255,0.3)]"
    : "border-white/5"

  return (
    <div
      className={cn(
        "absolute arch-node p-8 rounded-[3.5rem] border shadow-2xl cursor-move select-none min-w-[400px] transition-shadow duration-500",
        "bg-white/[0.03] backdrop-blur-2xl",
        "hover:shadow-[0_0_60px_rgba(0,242,255,0.08)]",
        statusColor
      )}
      style={{ left: component.position.x, top: component.position.y }}
      onMouseDown={handleMouseDown}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(component.id) }}
        className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
      </button>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", COLOR_MAP[def?.color || "cyan"])}>
            {Icon && <Icon className="h-6 w-6" />}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{def?.name || component.type}</h3>
            {def && (
              <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border", CATEGORY_COLORS[def.category])}>
                {def.category}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          {component.roiScore !== undefined && (
            <div>
              <span className="text-muted-foreground text-[10px] uppercase tracking-widest">ROI</span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-20 bg-white/10 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", component.roiScore > 70 ? "bg-emerald-400" : component.roiScore > 40 ? "bg-amber-400" : "bg-red-400")}
                    style={{ width: `${component.roiScore}%` }} />
                </div>
                <span className="text-xs font-mono">{component.roiScore}%</span>
              </div>
            </div>
          )}
          {component.riskScore !== undefined && (
            <div>
              <span className="text-muted-foreground text-[10px] uppercase tracking-widest">Risk</span>
              <span className={cn("text-xs font-mono", component.riskScore > 60 ? "text-red-400" : "text-emerald-400")}>
                {component.riskScore}/100
              </span>
            </div>
          )}
        </div>

        {def && (
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
            {def.unitEconomics}
          </div>
        )}
      </div>
    </div>
  )
}
