"use client"

import { useRef, useCallback } from "react"
import { ArchComponent } from "@/types/architecture"
import { cn } from "@/lib/utils"
import { Tooltip } from "@/components/ui/tooltip"
import {
  Cpu, Shield, CreditCard, Key, ShieldCheck, Database, Zap,
  ArrowLeftRight, ChartColumn, BookOpen, Cloud, HardDrive, Network,
  Wallet, Percent, Repeat, Store, Heart, Scale, Bell, X, AlertCircle
} from "lucide-react"

const ICON_MAP: Record<string, any> = {
  LayoutDashboard: Cpu, Shield, CreditCard, Key, ShieldCheck, Database,
  Zap: Zap, ArrowLeftRight, ChartColumn, BookOpen, Cloud, HardDrive,
  Network, Wallet, Percent, Repeat, Store, Heart, Scale, Bell, Cpu,
}

function getIcon(name: string) {
  return ICON_MAP[name] || Cpu
}

interface CanvasNodeProps {
  component: ArchComponent & { hasGovernanceGap?: boolean }
  isSelected: boolean
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onDrag: (id: string, x: number, y: number) => void
  isSimulating: boolean
  heatmapMode: "none" | "roi" | "risk" | "quality"
}

export function CanvasNode({ component, isSelected, onSelect, onRemove, onDrag, isSimulating, heatmapMode }: CanvasNodeProps) {
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, compX: 0, compY: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(component.id)
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      compX: component.position.x,
      compY: component.position.y,
    }
    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current.dragging) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      onDrag(component.id, dragRef.current.compX + dx, dragRef.current.compY + dy)
    }
    const handleUp = () => {
      dragRef.current.dragging = false
      document.removeEventListener("mousemove", handleMove)
      document.removeEventListener("mouseup", handleUp)
    }
    document.addEventListener("mousemove", handleMove)
    document.addEventListener("mouseup", handleUp)
  }, [component.id, component.position.x, component.position.y, onSelect, onDrag])

  const borderColor = isSimulating
    ? component.status === "failed" ? "border-red-500/50" : "border-cyan-500/30"
    : isSelected ? "border-primary/50" : "border-white/5"

  const bgGlow = heatmapMode === "roi"
    ? `shadow-[0_0_30px_rgba(16,185,129,${component.roiScore / 200})]`
    : heatmapMode === "risk"
    ? `shadow-[0_0_30px_rgba(249,115,22,${component.riskScore / 200})]`
    : ""

  const Icon = getIcon(component.type)

  return (
    <div
      className={cn(
        "absolute arch-node p-5 rounded-[2rem] border shadow-2xl cursor-move select-none min-w-[240px] transition-all duration-300",
        "bg-white/[0.03] backdrop-blur-2xl hover:shadow-[0_0_60px_rgba(0,242,255,0.08)]",
        borderColor, bgGlow,
        component.status === "failed" && "opacity-60"
      )}
      style={{ left: component.position.x, top: component.position.y }}
      onMouseDown={handleMouseDown}
    >
      <div className="flex items-start gap-3.5">
        <div className={cn(
          "h-9 w-9 rounded-2xl flex items-center justify-center shrink-0 border",
          component.status === "failed" ? "border-red-500/30 bg-red-500/10 text-red-400" :
          "border-white/10 bg-white/5 text-muted-foreground"
        )}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold truncate">{component.name}</h3>
            {component.hasGovernanceGap && <AlertCircle size={12} className="text-orange-400 shrink-0" />}
          </div>
          <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60">{component.type}</span>
          {isSimulating && (
            <div className="flex gap-3 mt-1">
              <span className={cn(
                "text-[9px] font-mono",
                component.status === "failed" ? "text-red-400" : "text-emerald-400/60"
              )}>{component.latency}ms</span>
              <span className="text-[9px] font-mono text-cyan-400/60">{component.throughput}/s</span>
            </div>
          )}
          <div className="flex gap-2 mt-1.5">
            {heatmapMode === "roi" && (
              <span className="text-[9px] font-bold text-emerald-400 font-mono">ROI:{component.roiScore}</span>
            )}
            {heatmapMode === "risk" && (
              <span className="text-[9px] font-bold text-orange-400 font-mono">RISK:{component.riskScore}</span>
            )}
            {heatmapMode === "quality" && (
              <span className="text-[9px] font-bold text-blue-400 font-mono">DEBT:{component.techDebtScore}</span>
            )}
          </div>
        </div>
        <Tooltip content="Remove component">
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(component.id) }}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={14} className="text-muted-foreground hover:text-foreground" />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
