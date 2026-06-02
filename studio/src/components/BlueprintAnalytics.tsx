"use client"

import { Separator } from "@/components/ui/separator"

interface BlueprintAnalyticsProps {
  revenueBreakdown?: { txnFees: number; subscriptions: number; usage: number; premium: number }
  businessImpact?: { score: number; revenuePotential: number; riskManagement: number; targetROI: number; marginLift: number }
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value}%</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-panel rounded-[2rem] p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-xl font-bold font-heading mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  )
}

export function BlueprintAnalytics({ revenueBreakdown, businessImpact }: BlueprintAnalyticsProps) {
  const rev = revenueBreakdown || { txnFees: 25, subscriptions: 60, usage: 10, premium: 5 }
  const biz = businessImpact || { score: 73, revenuePotential: 85, riskManagement: 62, targetROI: 140, marginLift: 25 }

  return (
    <div className="flex flex-col h-full bg-transparent p-6 space-y-6 overflow-y-auto">
      <div>
        <h2 className="text-lg font-semibold">Analytics</h2>
        <p className="text-sm text-muted-foreground">Business impact and revenue intelligence</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Impact Score" value={biz.score.toString()} sub="Overall architecture score" />
        <MetricCard label="Target ROI" value={`${biz.targetROI}%`} sub={`+${biz.marginLift}% margin lift`} />
        <MetricCard label="Revenue Potential" value={`${biz.revenuePotential}/100`} />
        <MetricCard label="Risk Management" value={`${biz.riskManagement}/100`} />
      </div>

      <div className="glass-panel rounded-[2rem] p-6 space-y-4">
        <div className="text-sm font-semibold uppercase tracking-widest">Monetization Mix</div>
        <Bar label="TXN Fees (25%)" value={rev.txnFees} max={100} color="bg-blue-400" />
        <Bar label="SaaS Subs (60%)" value={rev.subscriptions} max={100} color="bg-cyan-400" />
        <Bar label="White-Label (10%)" value={rev.usage} max={100} color="bg-purple-400" />
        <Bar label="Add-Ons (5%)" value={rev.premium} max={100} color="bg-emerald-400" />
      </div>

      <div className="glass-panel rounded-[2rem] p-6 space-y-4">
        <div className="text-sm font-semibold uppercase tracking-widest">Economic Yield</div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground text-[10px] uppercase">Est. Annual TCO</div>
            <div className="text-lg font-bold font-heading">$156,000</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px] uppercase">Revenue/Month</div>
            <div className="text-lg font-bold font-heading text-emerald-400">$8,400/mo</div>
          </div>
        </div>
        <Separator className="my-2" />
        <div className="text-sm">
          <span className="text-emerald-400 font-bold">+25% Margin</span>
          <span className="text-muted-foreground"> vs baseline infrastructure</span>
        </div>
      </div>
    </div>
  )
}
