"use client"

import { useState } from "react"
import { Menu, X, Search, GitBranch, BarChart3, LayoutDashboard, Zap, Cog, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

const navItems = [
  { id: "insights", label: "Synapse Insights", icon: LayoutDashboard },
  { id: "playground", label: "Semantic Playground", icon: Search },
  { id: "graph", label: "Graph Explorer", icon: GitBranch },
  { id: "roi", label: "Business ROI Inspector", icon: BarChart3 },
]

interface LayoutProps {
  activeTab: string
  onTabChange: (tab: string) => void
  children: React.ReactNode
}

export function Layout({ activeTab, onTabChange, children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r bg-card transition-transform duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-heading text-lg font-bold">Archisynapse</span>
        </div>
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-1 px-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { onTabChange(item.id); setSidebarOpen(false) }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  activeTab === item.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
          <Separator className="my-4 mx-2 w-auto" />
          <div className="px-4 py-2">
            <p className="text-xs font-medium text-muted-foreground">Blueprint Registry</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">v0.3 — Knowledge Graph</p>
          </div>
        </ScrollArea>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">Elite Payment Architecture Studio</span>
          </div>
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <a href="https://archisynapse-production.up.railway.app/api/v1/health" target="_blank" rel="noreferrer">
              <Cog className="h-3 w-3" />
              API
            </a>
          </Button>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
