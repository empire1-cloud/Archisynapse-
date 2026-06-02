"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api, type Blueprint, type BundleResult } from "@/lib/api"
import { DollarSign, TrendingUp, Loader2, Lightbulb, GitBranch } from "lucide-react"
import { Separator } from "@/components/ui/separator"

const ROI_ESTIMATES: Record<string, { savings: string; impact: string; timeline: string }> = {
  "Micro-Royalty Streaming": {
    savings: "$12k–$48k/yr in settlement costs",
    impact: "Eliminates batch latency; enables pay-per-play economics",
    timeline: "4–6 weeks to MVP",
  },
  "Creator Royalty Split": {
    savings: "$4k–$15k/yr in dispute resolution",
    impact: "Reduces royalty disputes by ~60% with transparent graphs",
    timeline: "2–3 weeks to MVP",
  },
  "Event-Driven Settlement": {
    savings: "$8k–$24k/yr in reconciliation overhead",
    impact: "Near real-time settlement vs daily batches",
    timeline: "6–8 weeks to MVP",
  },
  "AI Music Generation Pipeline": {
    savings: "$20k–$80k/yr in licensing friction",
    impact: "Attribution at creation time, not retroactively",
    timeline: "8–12 weeks to MVP",
  },
  "Multi-Agent Workflow": {
    savings: "$6k–$20k/yr in coordination overhead",
    impact: "Clear handoffs reduce errors by ~40%",
    timeline: "4–8 weeks to MVP",
  },
  "Compliance-Aware Routing": {
    savings: "$15k–$60k/yr in compliance fines avoided",
    impact: "Multi-jurisdiction routing with zero manual review",
    timeline: "8–12 weeks to MVP",
  },
  "Creator Subscription Model": {
    savings: "$3k–$10k/yr in churn reduction",
    impact: "Recurring revenue with tiered entitlements",
    timeline: "3–4 weeks to MVP",
  },
  "Digital Asset Provenance": {
    savings: "$5k–$18k/yr in audit costs",
    impact: "Append-only provenance eliminates ownership disputes",
    timeline: "4–6 weeks to MVP",
  },
  "Marketplace Escrow Pattern": {
    savings: "$10k–$30k/yr in dispute overhead",
    impact: "Automated escrow with transparent rules",
    timeline: "4–6 weeks to MVP",
  },
  "Attribution Graph Pattern": {
    savings: "$7k–$25k/yr in attribution gaps",
    impact: "Graph-based influence tracking across works",
    timeline: "6–10 weeks to MVP",
  },
}

const FLYWHEEL_INSIGHTS = [
  "The Blueprint Registry is Archisynapse's defensible moat — competitors have payment APIs, you have payment architecture intelligence.",
  "Graph-aware scoring boosts bundle recommendations over isolated pattern matching, driving higher-value architecture proposals.",
  "Every usage signal strengthens the graph — the system gets smarter with each query, creating a self-reinforcing flywheel.",
  "Blueprint bundles increase average deal size by 3-5x compared to single-pattern recommendations.",
]

export function BusinessROIInspector() {
  const [blueprints, setBlueprints] = useState<Blueprint[]>([])
  const [bundle, setBundle] = useState<BundleResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [bundleLoading, setBundleLoading] = useState(false)

  useEffect(() => {
    api.listBlueprints({ limit: 20 }).then(r => {
      setBlueprints(r.items)
      setLoading(false)
    })
  }, [])

  async function generateBundle() {
    setBundleLoading(true)
    try {
      const ids = blueprints.slice(0, 3).map(b => b.id)
      const result = await api.graphBundle(ids, "Recommended Architecture Stack", "AI-powered creator economy infrastructure")
      setBundle(result)
    } catch {
      // ignore
    } finally {
      setBundleLoading(false)
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
        <h1 className="font-heading text-2xl font-bold">Business ROI Inspector</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Estimated cost savings and revenue impact per blueprint pattern
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {blueprints.map(bp => {
          const roi = ROI_ESTIMATES[bp.name]
          return (
            <Card key={bp.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm">{bp.name}</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">{bp.complexity}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {roi ? (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-green-400" />
                      <span className="text-green-400 font-medium">{roi.savings}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{roi.impact}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3" />
                      {roi.timeline}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No ROI estimate available for this pattern.</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flywheel Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {FLYWHEEL_INSIGHTS.map((insight, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <Lightbulb className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <p className="text-muted-foreground">{insight}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Architecture Bundle Simulator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate a recommended bundle from the top blueprints and see the combined graph connectivity.
          </p>
          <Button onClick={generateBundle} disabled={bundleLoading}>
            {bundleLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GitBranch className="h-4 w-4 mr-2" />}
            Generate Bundle
          </Button>

          {bundle && (
            <div className="space-y-3 mt-4">
              <Separator />
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold font-heading">{bundle.blueprints.length}</div>
                  <div className="text-xs text-muted-foreground">Blueprints</div>
                </div>
                <div>
                  <div className="text-lg font-bold font-heading">{bundle.edgeCount}</div>
                  <div className="text-xs text-muted-foreground">Internal Edges</div>
                </div>
                <div>
                  <div className="text-lg font-bold font-heading">{bundle.avgConnectivity.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">Avg Connectivity</div>
                </div>
              </div>
              <div className="space-y-2">
                {bundle.blueprints.map((b, i) => (
                  <div key={i} className="flex items-center justify-between py-1 text-sm">
                    <span>{b.blueprint.name}</span>
                    <Badge variant="outline" className="text-[10px]">{b.connectivityScore.toFixed(3)}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
