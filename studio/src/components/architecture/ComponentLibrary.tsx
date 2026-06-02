"use client"

import { useState } from "react"
import { ComponentType, COMPONENT_METADATA } from "@/types/architecture"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Cpu, Shield, CreditCard, Key, ShieldCheck, Database, Zap,
  ArrowLeftRight, ChartColumn, BookOpen, Cloud, HardDrive, Network,
  Wallet, Percent, Repeat, Store, Heart, Scale, Bell, Search, Braces, Globe
} from "lucide-react"

const CATEGORIES = [
  { id: "premium", label: "Premium", color: "text-purple-400" },
  { id: "purple", label: "Purple", color: "text-pink-400" },
  { id: "gold", label: "Gold", color: "text-amber-400" },
  { id: "core", label: "Core", color: "text-blue-400" },
] as const

const ICON_MAP: Record<string, any> = {
  LayoutDashboard: Cpu, Shield, CreditCard, Key, ShieldCheck, Database,
  Zap, ArrowLeftRight, ChartColumn, BookOpen, Cloud, HardDrive,
  Network, Wallet, Percent, Repeat, Store, Heart, Scale, Bell, Braces, Globe,
}

function getIcon(name: string) {
  return ICON_MAP[name] || Cpu
}

interface ComponentLibraryProps {
  onAddComponent: (type: ComponentType) => void
}

export function ComponentLibrary({ onAddComponent }: ComponentLibraryProps) {
  const [search, setSearch] = useState("")
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const filtered = Object.entries(COMPONENT_METADATA).filter(([type, meta]) => {
    if (!search) return true
    const q = search.toLowerCase()
    return type.includes(q) || meta.defaultName.toLowerCase().includes(q) || meta.tags.some(t => t.includes(q))
  })

  const grouped = CATEGORIES.map(cat => ({
    ...cat,
    items: filtered.filter(([, meta]) => meta.category === cat.id),
  })).filter(g => g.items.length > 0)

  return (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search SLA113 stack..."
            className="pl-9 h-9 text-xs rounded-xl"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
        {grouped.map(group => (
          <div key={group.id}>
            <button
              onClick={() => setCollapsed(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
              className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <span className={cn("text-[10px] font-black uppercase tracking-widest", group.color)}>
                {group.label} Stack
              </span>
            </button>
            {!collapsed[group.id] && (
              <div className="ml-1 space-y-0.5 mt-0.5">
                {group.items.map(([type, meta]) => {
                  const Icon = getIcon(meta.icon)
                  return (
                    <button
                      key={type}
                      onClick={() => onAddComponent(type as ComponentType)}
                      className="group flex items-center gap-2.5 w-full px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                    >
                      <div className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0 bg-white/5 text-muted-foreground">
                        <Icon size={12} />
                      </div>
                      <span>{meta.defaultName}</span>
                      <span className="ml-auto text-[9px] text-muted-foreground/40 opacity-0 group-hover:opacity-100 font-mono">{type}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
