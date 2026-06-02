"use client"

import { useState } from "react"
import { Search, Loader2, Plus, TrendingUp, GitBranch, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { api, type MatchResult } from "@/lib/api"

interface SemanticSearchPanelProps {
  onAddComponent: (type: string, name: string) => void
}

export function SemanticSearchPanel({ onAddComponent }: SemanticSearchPanelProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(false)

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true)
    try {
      const data = await api.matchBlueprints({ query, limit: 5 })
      setResults(data.items)
    } catch { setResults([]) }
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full bg-transparent p-6 space-y-6 overflow-y-auto">
      <div>
        <h2 className="text-lg font-semibold">Semantic Matching</h2>
        <p className="text-sm text-muted-foreground">Query the Blueprint Registry graph engine</p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Describe your architecture need..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          className="flex-1"
        />
        <Button variant="glow" size="icon" onClick={handleSearch} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-3 overflow-y-auto flex-1">
          {results.map((r, i) => (
            <div key={r.blueprint.id} className="group border-l-4 border-l-accent overflow-hidden hover:shadow-[0_0_40px_rgba(0,242,255,0.1)] transition-all glass-panel border border-white/5 p-4 rounded-[2rem]">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground font-mono">#{i + 1}</span>
                    <span className="font-semibold text-sm truncate">{r.blueprint.name}</span>
                    <Badge variant="secondary" className="text-[9px]">{r.blueprint.complexity}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{r.blueprint.description}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />{r.semanticScore?.toFixed(2)}</span>
                    <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" />{r.graphScore?.toFixed(2)}</span>
                    <span className="font-bold text-primary">{r.score.toFixed(2)}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onAddComponent(r.blueprint.slug || r.blueprint.id, r.blueprint.name)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {results.length === 0 && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Search for architecture patterns</p>
          </div>
        </div>
      )}
    </div>
  )
}
