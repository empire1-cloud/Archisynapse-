"use client"

import { useState } from "react"
import { Search, ChevronDown, ChevronRight, Book, Braces, Layers, GitBranch, Globe } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { COMPONENT_TYPES, STACK_ORDER, STACK_COLORS, COMPONENT_COLORS, getComponentType } from "@/components/ComponentRegistry"

const NAV_ITEMS = [
  { id: "registry", label: "Registry", icon: Book },
  { id: "semantic", label: "Semantic", icon: GitBranch },
  { id: "synapse", label: "Synapse", icon: Layers },
  { id: "lyrica-sdk", label: "Lyrica SDK", icon: Braces },
  { id: "assets", label: "Sovereign Assets", icon: Globe },
]

interface LeftSidebarProps {
  onAddComponent: (typeId: string) => void
  activeNav: string
  onNavChange: (nav: string) => void
}

export function LeftSidebar({ onAddComponent, activeNav, onNavChange }: LeftSidebarProps) {
  const [search, setSearch] = useState("")
  const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set(["PREMIUM", "PURPLE", "GOLD", "CORE"]))

  const toggleStack = (stack: string) => {
    setExpandedStacks(prev => {
      const next = new Set(prev)
      if (next.has(stack)) next.delete(stack)
      else next.add(stack)
      return next
    })
  }

  const filtered = COMPONENT_TYPES.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.id.includes(search.toLowerCase())
  )

  const grouped = STACK_ORDER.map(stack => ({
    stack,
    items: filtered.filter(c => c.stack === stack),
  }))

  return (
    <div className="w-72 border-r border-white/5 bg-card/30 backdrop-blur-2xl flex flex-col h-full">
      <div className="p-4 space-y-1 border-b border-white/5">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onNavChange(item.id)}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeNav === item.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search SLA113 stack..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
        {grouped.map(({ stack, items }) => {
          if (items.length === 0) return null
          return (
            <div key={stack}>
              <button
                onClick={() => toggleStack(stack)}
                className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                {expandedStacks.has(stack) ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                <span className={cn("text-[10px] font-black uppercase tracking-widest", STACK_COLORS[stack].split(" ")[0])}>{stack} Stack</span>
              </button>
              {expandedStacks.has(stack) && (
                <div className="ml-1 space-y-0.5 mt-0.5">
                  {items.map(comp => {
                    const Icon = comp.icon
                    const colorClass = COMPONENT_COLORS[comp.color] || COMPONENT_COLORS.cyan
                    return (
                      <button
                        key={comp.id}
                        onClick={() => onAddComponent(comp.id)}
                        className="group flex items-center gap-2.5 w-full px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                      >
                        <div className={cn("h-6 w-6 rounded-lg flex items-center justify-center shrink-0", colorClass.split(" ").slice(1).join(" "))}>
                          <Icon className="h-3 w-3" />
                        </div>
                        <span>{comp.name}</span>
                        <span className="ml-auto text-[9px] text-muted-foreground/40 opacity-0 group-hover:opacity-100 font-mono">{comp.slug}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
