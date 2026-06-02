"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { api, type Blueprint, type GraphInfo, type GraphEdge, type GraphNode } from "@/lib/api"
import { GitBranch, Loader2, ArrowRight, Dot } from "lucide-react"

const EDGE_COLORS: Record<string, string> = {
  "often-used-with": "text-blue-400",
  "prerequisite-for": "text-amber-400",
  requires: "text-red-400",
  "alternative-to": "text-purple-400",
  extends: "text-green-400",
  "recommended-pairing": "text-cyan-400",
}

export function GraphExplorer() {
  const [graphInfo, setGraphInfo] = useState<GraphInfo | null>(null)
  const [blueprints, setBlueprints] = useState<Blueprint[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [nodeData, setNodeData] = useState<GraphNode | null>(null)
  const [related, setRelated] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [nodeLoading, setNodeLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      api.graphInfo().then(setGraphInfo).catch(() => null),
      api.listBlueprints({ limit: 20 }).then(r => setBlueprints(r.items)),
    ]).finally(() => setLoading(false))
  }, [])

  async function selectBlueprint(id: string) {
    setSelected(id)
    setNodeLoading(true)
    try {
      const [node, rel] = await Promise.all([
        api.graphNode(id).catch(() => null),
        api.graphRelated(id, { limit: 5 }).catch(() => ({ items: [] })),
      ])
      setNodeData(node)
      setRelated(rel.items)
    } finally {
      setNodeLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Graph Explorer</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Explore the Blueprint Registry knowledge graph — {graphInfo?.nodes ?? 0} nodes, {graphInfo?.edges ?? 0} edges
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Blueprints</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {blueprints.map(bp => (
              <button
                key={bp.id}
                onClick={() => selectBlueprint(bp.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selected === bp.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-accent text-muted-foreground hover:text-accent-foreground"
                }`}
              >
                {bp.name}
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!selected && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Select a blueprint to explore its graph connections
              </CardContent>
            </Card>
          )}

          {nodeLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {selected && nodeData && !nodeLoading && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{nodeData.blueprint.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{nodeData.blueprint.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {nodeData.blueprint.tags.map(t => (
                      <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Degree:</span> {nodeData.degree}</div>
                    <div><span className="text-muted-foreground">Connectivity:</span> {nodeData.connectivityScore.toFixed(3)}</div>
                  </div>
                </CardContent>
              </Card>

              {nodeData.edges.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Direct Edges ({nodeData.edges.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {nodeData.edges.map(edge => (
                      <div key={edge.id} className="flex items-center gap-2 text-sm py-1">
                        <Dot className={`h-4 w-4 ${EDGE_COLORS[edge.type] ?? "text-muted-foreground"}`} />
                        <span className="font-mono text-xs text-muted-foreground">{edge.type}</span>
                        <span className="text-muted-foreground">→</span>
                        <span>{blueprints.find(b => b.id === edge.toId)?.name ?? edge.toId.slice(0, 8)}</span>
                        <Badge variant="outline" className="text-[10px] ml-auto">{(edge.confidence * 100).toFixed(0)}%</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {related.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Related Blueprints</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {related.map((r, i) => (
                      <div key={i} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <ArrowRight className="h-3 w-3 text-primary" />
                          <span className="text-sm">{r.blueprint.name}</span>
                          <Badge variant="outline" className="text-[10px]">{r.edgeType}</Badge>
                        </div>
                        <span className="text-sm font-mono text-muted-foreground">{(r.confidence * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Graph Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold font-heading">{graphInfo?.nodes ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Blueprints (nodes)</div>
                </div>
                <div>
                  <div className="text-2xl font-bold font-heading">{graphInfo?.edges ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Connections (edges)</div>
                </div>
              </div>
              {graphInfo?.edgeTypeBreakdown && (
                <>
                  <Separator className="my-3" />
                  <div className="space-y-1">
                    {Object.entries(graphInfo.edgeTypeBreakdown).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1">
                          <Dot className={`h-3 w-3 ${EDGE_COLORS[type] ?? "text-muted-foreground"}`} />
                          {type}
                        </span>
                        <span className="font-mono text-muted-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
