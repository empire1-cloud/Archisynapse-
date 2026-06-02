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
        "absolute arch-node p-6 rounded-[2.5rem] border shadow-2xl cursor-move select-none min-w-[280px] transition-all duration-500",
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
          <div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 border", COMPONENT_COLORS[def.color])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold truncate">{def?.name || component.type}</h3>
          {def && (
            <span className={cn("text-[9px] font-black uppercase tracking-widest", STACK_COLORS[def.stack].split(" ")[0])}>
              {def.stack}
            </span>
          )}
          <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{component.id.slice(0, 8)}</div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onRemove(component.id) }} className="opacity-0 group-hover:opacity-100 transition-opacity">
          <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
    </div>
  )
}
