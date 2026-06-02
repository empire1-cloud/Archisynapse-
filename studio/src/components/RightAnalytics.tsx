"use client"

import { BarChart3, TrendingUp, Shield, Clock, DollarSign, Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

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

export function RightAnalytics() {
  return (
    <div className="w-80 border-l border-white/5 bg-card/30 backdrop-blur-2xl flex flex-col h-full overflow-y-auto">
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Bidirectional Engine</h2>
            <span className="text-[10px] text-muted-foreground font-mono">v2.4</span>
          </div>
          <Badge variant="success">BRIDGE ACTIVE</Badge>
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
          <Metric icon={BarChart3} label="Impact Score" value="88/100" color="text-primary" />
          <Metric icon={TrendingUp} label="Revenue Potential" value="95" color="text-emerald-400" />
          <Metric icon={Shield} label="Risk Management" value="82" color="text-amber-400" />
          <Metric icon={Clock} label="Time-to-Market" value="85" color="text-cyan-400" />
        </div>

        <Separator />

        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Enablement Potential</div>
          <div className="text-xl font-bold font-heading text-emerald-400">+$240K / Year</div>
        </div>

        <Separator />

        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Monetization Triggers</div>
          <div className="space-y-2">
            {[
              { label: "Tiered SaaS Pricing", sub: "+15-25% Margin Lift" },
              { label: "Enterprise Licensing", sub: "Unlocked via Auth" },
              { label: "Direct Txn Fees", sub: "via Fee Engine" },
              { label: "Secondary Marketplace", sub: "Revenue Potential" },
            ].map(t => (
              <div key={t.label} className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/5">
                <div>
                  <div className="text-xs font-medium">{t.label}</div>
                  <div className="text-[10px] text-muted-foreground">{t.sub}</div>
                </div>
                <DollarSign className="h-3.5 w-3.5 text-emerald-400/60" />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">TCO Breakdown</div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Infrastructure</span>
              <span className="font-mono">$8,400/mo</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Compliance</span>
              <span className="font-mono">$1,200/mo</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Talent (FTE)</span>
              <span className="font-mono">1.5 FTE</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payback</span>
              <span className="font-mono">2.4 Months</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm font-semibold">
              <span>Estimated Annual TCO</span>
              <span className="text-primary font-heading">$156,000</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
