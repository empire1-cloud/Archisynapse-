"use client"

import { useState } from "react"
import { Layers, Zap, Search, Save, GitCompare, FileText, Loader2, Check, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const TABS = [
  { id: "stack", label: "Stack", icon: Layers },
  { id: "synapse", label: "Synapse", icon: Zap },
  { id: "semantic", label: "Semantic", icon: Search },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
]

interface TopToolbarProps {
  activeTab: string
  onTabChange: (tab: string) => void
  blueprintName: string
  onSave: () => void
  saving: boolean
  saved: boolean
  stats: { components: number; edges: number }
}

export function TopToolbar({ activeTab, onTabChange, blueprintName, onSave, saving, saved, stats }: TopToolbarProps) {
  return (
    <div className="h-20 border-b bg-card/40 backdrop-blur-3xl flex items-center justify-between px-8 z-30 sticky top-0 border-white/5 shadow-2xl">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-heading text-lg font-bold hidden sm:inline">Archisynapse</span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 rounded-full p-1.5 bg-white/5 ring-1 ring-white/10">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-3 w-3" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <span>{stats.components} components</span>
          <span className="text-white/10">|</span>
          <span>{stats.edges} edges</span>
        </div>

        <Button variant="ghost" size="sm" className="hidden sm:flex gap-2">
          <GitCompare className="h-3 w-3" />
          Compare
        </Button>

        <Button variant="ghost" size="sm" className="hidden sm:flex gap-2">
          <FileText className="h-3 w-3" />
          Briefing
        </Button>

        <Button variant="glow" size="sm" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
          {saved ? "Saved" : saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  )
}
