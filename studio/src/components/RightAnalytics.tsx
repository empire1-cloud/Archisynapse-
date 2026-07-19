"use client"

import { BarChart3, TrendingUp, Shield, Clock, DollarSign, Target, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { PayoutRecord } from "@/lib/api"

interface MetricProps {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  color?: string
}

function Metric({ icon: Icon, label, value, sub, color }: MetricProps) {
  return (
    <div className="flex items-start gap-3">
      <Icon className={cn("h-4 w-4 mt-0.5", color || "text-muted-foreground")} />
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className={cn("text-lg font-bold font-heading", color)}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  )
}

interface AnalyticsBar {
  label: string
  value: number
  tone?: string
}

interface RecommendationSignal {
  title: string
  subtitle: string
}

interface SystemSignal {
  label: string
  value: string
}

interface RightAnalyticsProps {
  engineLabel: string
  bridgeStatus: string
  bridgeVariant: "success" | "secondary" | "destructive"
  summaryMetrics: Array<{ icon: React.ElementType; label: string; value: string; color?: string; sub?: string }>
  scoreBars: AnalyticsBar[]
  monetizationPotential: string
  recommendations: RecommendationSignal[]
  heldPayouts: PayoutRecord[]
  releasingPayoutId: string | null
  onReleasePayout: (payoutId: string) => void
  systemSignals: SystemSignal[]
}

function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function RightAnalytics({
  engineLabel,
  bridgeStatus,
  bridgeVariant,
  summaryMetrics,
  scoreBars,
  monetizationPotential,
  recommendations,
  heldPayouts,
  releasingPayoutId,
  onReleasePayout,
  systemSignals,
}: RightAnalyticsProps) {
  return (
    <div className="w-80 border-l border-white/5 bg-card/30 backdrop-blur-2xl flex flex-col h-full overflow-y-auto">
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">{engineLabel}</h2>
            <span className="text-[10px] text-muted-foreground font-mono">v2.4</span>
          </div>
          <Badge variant={bridgeVariant}>{bridgeStatus}</Badge>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="space-y-1">
          <button className="flex items-center gap-2 w-full px-3 py-2 rounded-xl hover:bg-white/5 text-xs text-muted-foreground hover:text-foreground transition-all uppercase tracking-widest font-black">
            <BarChart3 className="h-3.5 w-3.5" /> GTM Audit
          </button>
          <button className="flex items-center gap-2 w-full px-3 py-2 rounded-xl hover:bg-white/5 text-xs text-muted-foreground hover:text-foreground transition-all uppercase tracking-widest font-black">
            <TrendingUp className="h-3.5 w-3.5" /> Lyrica Flow
          </button>
          <button className="flex items-center gap-2 w-full px-3 py-2 rounded-xl hover:bg-white/5 text-xs text-muted-foreground hover:text-foreground transition-all uppercase tracking-widest font-black">
            <Target className="h-3.5 w-3.5" /> Venture Intel
          </button>
          <button className="flex items-center gap-2 w-full px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs uppercase tracking-widest font-black">
            <Shield className="h-3.5 w-3.5" /> SLA113 Strategic Audit
          </button>
        </div>

        <Separator />

        <div className="space-y-4">
          {summaryMetrics.map((metric) => (
            <Metric
              key={metric.label}
              icon={metric.icon}
              label={metric.label}
              value={metric.value}
              color={metric.color}
              sub={metric.sub}
            />
          ))}
        </div>

        <Separator />

        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Enablement Potential</div>
          <div className="text-xl font-bold font-heading text-emerald-400">{monetizationPotential}</div>
        </div>

        <Separator />

        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Recommendation Signals</div>
          <div className="space-y-2">
            {recommendations.map((item) => (
              <div key={`${item.title}-${item.subtitle}`} className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/5">
                <div>
                  <div className="text-xs font-medium">{item.title}</div>
                  <div className="text-[10px] text-muted-foreground">{item.subtitle}</div>
                </div>
                <DollarSign className="h-3.5 w-3.5 text-emerald-400/60" />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Manual Review Queue</div>
            <Badge variant={heldPayouts.length > 0 ? "secondary" : "outline"}>{heldPayouts.length}</Badge>
          </div>
          <div className="space-y-2">
            {heldPayouts.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-3 text-xs text-emerald-300">
                No payouts are waiting on human review.
              </div>
            ) : (
              heldPayouts.map((payout) => (
                <div key={payout.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-foreground">
                        {formatMoney(payout.amount, payout.currency || "USD")}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {payout.sourceType || "PAYOUT"} • {payout.id.slice(0, 10)}
                      </div>
                    </div>
                    <Badge variant="outline">
                      Risk {payout.riskDecision?.riskScore ?? "--"}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {(payout.riskDecision?.reasons || []).slice(0, 2).join(" • ") || "Awaiting analyst release"}
                  </div>
                  <Button
                    size="sm"
                    className="w-full rounded-xl"
                    disabled={releasingPayoutId === payout.id}
                    onClick={() => onReleasePayout(payout.id)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                    {releasingPayoutId === payout.id ? "Releasing..." : "Release Payout"}
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <Separator />

        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Live System State</div>
          <div className="space-y-3 mb-5">
            {scoreBars.map((bar) => (
              <div key={bar.label}>
                <div className="flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  <span>{bar.label}</span>
                  <span className="font-mono text-foreground">{bar.value}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full bg-primary", bar.tone)}
                    style={{ width: `${Math.max(0, Math.min(100, bar.value))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {systemSignals.map((signal) => (
              <div key={signal.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{signal.label}</span>
                <span className="font-mono">{signal.value}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between text-sm font-semibold">
              <span>Signal Register</span>
              <span className="text-primary font-heading">{systemSignals.length} tracked</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
