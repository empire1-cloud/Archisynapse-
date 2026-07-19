"use client"

import { useCallback, useRef } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { getComponentType, COMPONENT_COLORS, STACK_COLORS } from "@/components/ComponentRegistry"

export interface CanvasComponent {
  id: string
  type: string
  position: { x: number; y: number }
  status?: string
  label?: string
  subtitle?: string
  metricLabel?: string
  metricValue?: string
  latencyMs?: number
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
    dragRef.current = { startX: e.clientX, startY: e.clientY, nodeX: component.position.x, nodeY: component.position.y, dragging: false }
    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.dragging = true
      if (dragRef.current.dragging) onDrag(component.id, dragRef.current.nodeX + dx, dragRef.current.nodeY + dy)
    }
    const handleMouseUp = () => {
      if (!dragRef.current.dragging) onSelect(component.id)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }, [component, onSelect, onDrag])

  const isFailed = component.status === "failed"
  const isStandby = component.status === "standby"

  return (
    <div
      className={cn(
        "group absolute arch-node p-6 rounded-[2.5rem] border shadow-2xl cursor-move select-none min-w-[280px] transition-all duration-500",
        "bg-white/[0.03] backdrop-blur-2xl hover:shadow-[0_0_60px_rgba(0,242,255,0.08)]",
        isFailed ? "border-destructive/80 ring-8 ring-destructive/80 bg-destructive/30 animate-pulse" :
        isStandby ? "border-amber-500/50 ring-4 ring-amber-500/40" :
        isSelected ? "ring-[12px] ring-accent/60 border-accent/80 shadow-[0_0_200px_rgba(0,242,255,0.3)]" :
        "border-white/5"
      )}
      style={{ left: component.position.x, top: component.position.y }}
      onMouseDown={handleMouseDown}
    >
      <div className="flex items-start gap-4">
        {Icon && def && (
          <div className={cn("h-16 w-16 rounded-[1.75rem] flex items-center justify-center shrink-0 border", COMPONENT_COLORS[def.color])}>
            <Icon className="h-7 w-7" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-[2rem] leading-none font-black tracking-tight truncate">
            {component.label || def?.name || component.type}
          </h3>
          <div className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mt-5">
            {component.subtitle || def?.slug || component.type}
          </div>
          {def && (
            <span className={cn("text-[9px] font-black uppercase tracking-widest mt-4 inline-block", STACK_COLORS[def.stack].split(" ")[0])}>
              {def.stack}
            </span>
          )}
          <div className="mt-8 border-t border-dashed border-white/10 pt-8 flex items-end justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                {component.metricLabel || "Yield"}
              </div>
              <div className="text-3xl font-heading font-bold text-primary mt-3">
                {component.metricValue || "90%"}
              </div>
            </div>
            {typeof component.latencyMs === "number" && (
              <div className="rounded-full border border-primary/30 bg-primary/10 text-primary px-5 py-2 text-lg font-black">
                {component.latencyMs}MS
              </div>
            )}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground mt-5">{component.id.slice(0, 12)}</div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onRemove(component.id) }} className="opacity-0 group-hover:opacity-100 transition-opacity">
          <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
    </div>
  )
}
