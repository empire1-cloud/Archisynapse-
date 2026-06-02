"use client"

import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { FileText, Sparkles, Scale, TrendingUp, Loader2, Zap, Vault } from "lucide-react"

interface HeaderProps {
  blueprintName: string
  onSave: () => void
  onExport: () => void
  onGenerate: () => void
  onBriefing: () => void
  onCompare: () => void
  stats: { roi: number; security: number; efficiency: number; governanceGaps: number; revenue: number }
  isGeneratingBriefing?: boolean
}

export function Header({ blueprintName, onSave, onGenerate, onBriefing, onCompare, stats, isGeneratingBriefing }: HeaderProps) {
  return (
    <header className="h-16 border-b border-white/5 bg-background/60 backdrop-blur-2xl flex items-center justify-between px-8 z-40 shrink-0">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Zap size={16} className="text-primary" />
          </div>
          <span className="font-headline text-sm font-bold tracking-tight">Archisynapse</span>
        </div>
        <div className="h-4 w-px bg-white/10" />
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">{blueprintName}</span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={12} className="text-emerald-400" />
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">ROI</span>
            <span className="text-xs font-bold text-emerald-400">{stats.roi}%</span>
          </div>
          <div className="flex items-center gap-2">
            <Scale size={12} className="text-primary" />
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">TRUST</span>
            <span className="text-xs font-bold text-primary">{stats.security}%</span>
          </div>
          {stats.revenue > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">YIELD</span>
              <span className="text-xs font-bold text-emerald-400 font-mono">${stats.revenue.toFixed(0)}</span>
            </div>
          )}
          {stats.governanceGaps > 0 && (
            <div className="px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20">
              <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest">{stats.governanceGaps} GAP{(stats.governanceGaps !== 1) ? 'S' : ''}</span>
            </div>
          )}
        </div>
        <div className="h-4 w-px bg-white/10" />
        <div className="flex items-center gap-1.5">
          <Tooltip content="Synthesize new blueprint from strategic goal">
            <Button variant="ghost" size="sm" onClick={onGenerate} className="text-[9px]">
              <Sparkles size={12} className="mr-1" /> New Strategy
            </Button>
          </Tooltip>
          <Tooltip content="Generate executive board briefing">
            <Button variant="ghost" size="sm" onClick={onBriefing} disabled={isGeneratingBriefing} className="text-[9px]">
              {isGeneratingBriefing ? <Loader2 size={12} className="animate-spin mr-1" /> : <FileText size={12} className="mr-1" />}
              Board Briefing
            </Button>
          </Tooltip>
          <Tooltip content="Compare current vs vaulted strategy">
            <Button variant="ghost" size="sm" onClick={onCompare} className="text-[9px]">
              <Scale size={12} className="mr-1" /> Compare
            </Button>
          </Tooltip>
          <Tooltip content="Save current design to vault">
            <Button variant="glass" size="sm" onClick={onSave} className="text-[9px]">
              <Vault size={12} className="mr-1" /> Vault
            </Button>
          </Tooltip>
        </div>
      </div>
    </header>
  )
}
