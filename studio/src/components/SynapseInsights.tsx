"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api, type Blueprint, type GraphInfo, type DashboardMetrics } from "@/lib/api"
import { Zap, GitBranch, Layers, TrendingUp, Activity } from "lucide-react"

export function SynapseInsights() {
  const [blueprints, setBlueprints] = useState<Blueprint[]>([])
  const [graph, setGraph] = useState<GraphInfo | null>(null)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.listBlueprints({ limit: 20 }).then(r => setBlueprints(r.items)),
      api.graphInfo().then(setGraph).catch(() => null),
      api.dashboard().then(setMetrics).catch(() => null),
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const byComplexity = {
    low: blueprints.filter(b => b.complexity === "low").length,
    medium: blueprints.filter(b => b.complexity === "medium").length,
    high: blueprints.filter(b => b.complexity === "high").length,
  }

  const categories = [...new Set(blueprints.map(b => b.category))]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Synapse Insights</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time intelligence from the Blueprint Registry knowledge graph</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Blueprints</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{blueprints.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {byComplexity.low} low · {byComplexity.medium} med · {byComplexity.high} high
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Graph Edges</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{graph?.edges ?? "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">{graph?.edgeTypes ?? 0} edge types</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{categories.join(", ")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalTransactions ?? "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.totalRevenue ? `$${(metrics.totalRevenue / 100).toLocaleString()} volume` : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Blueprint Registry</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {blueprints.map(bp => (
              <div key={bp.id} className="flex items-start justify-between py-3 first:pt-0 last:pb-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{bp.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{bp.complexity}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{bp.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {bp.tags.slice(0, 4).map(t => (
                      <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                </div>
                <Zap className={`h-4 w-4 mt-1 ${bp.complexity === "high" ? "text-primary" : "text-muted-foreground"}`} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
