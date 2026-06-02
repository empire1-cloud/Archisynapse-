"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { api, type MatchResult } from "@/lib/api"
import { Search, Loader2, TrendingUp, GitBranch } from "lucide-react"

const SUGGESTED_QUERIES = [
  "ai music generation with real-time royalties",
  "cross-border payouts for creators",
  "multi-agent creative workflow",
  "compliance-aware global routing",
]

export function SemanticPlayground() {
  const [query, setQuery] = useState("")
  const [tags, setTags] = useState("")
  const [results, setResults] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [searched, setSearched] = useState(false)

  async function handleSearch(q?: string) {
    const searchQuery = q ?? query
    if (!searchQuery.trim()) return
    setLoading(true)
    setError("")
    setSearched(true)
    try {
      const tagList = tags
        .split(",")
        .map(t => t.trim())
        .filter(Boolean)
      const data = await api.matchBlueprints({ query: searchQuery, tags: tagList.length ? tagList : undefined, limit: 5 })
      setResults(data.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed")
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Semantic Playground</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Query the Blueprint Registry with graph-aware semantic search
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Architecture Query</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Describe the architecture you need..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={() => handleSearch()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Search
            </Button>
          </div>
          <Input
            placeholder="Optional: filter by tags (comma-separated, e.g. ai, music, royalties)"
            value={tags}
            onChange={e => setTags(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground py-1">Try:</span>
            {SUGGESTED_QUERIES.map(q => (
              <button
                key={q}
                onClick={() => { setQuery(q); handleSearch(q) }}
                className="text-xs px-2 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {searched && !loading && !error && (
        <div className="space-y-3">
          {results.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No matching blueprints found. Try a different query.
              </CardContent>
            </Card>
          ) : (
            results.map((r, i) => (
              <Card key={r.blueprint.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">#{i + 1}</span>
                        <span className="font-medium">{r.blueprint.name}</span>
                        <Badge variant="secondary" className="text-[10px]">{r.blueprint.complexity}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{r.blueprint.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {r.blueprint.tags.slice(0, 6).map(t => (
                          <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right ml-4 space-y-1">
                      <div className="text-2xl font-bold font-heading text-primary">{r.score.toFixed(2)}</div>
                      <div className="flex items-center gap-2 justify-end text-xs text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        <span>{r.semanticScore?.toFixed(2) ?? "—"} semantic</span>
                      </div>
                      <div className="flex items-center gap-2 justify-end text-xs text-muted-foreground">
                        <GitBranch className="h-3 w-3" />
                        <span>{r.graphScore?.toFixed(2) ?? "—"} graph</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
