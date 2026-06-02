"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function TopBar() {
  return (
    <div className="h-20 border-b bg-card/40 backdrop-blur-3xl border-white/5 shadow-2xl flex flex-col justify-center px-8 z-30 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-heading text-xl font-bold">Archisynapse Sovereign Core</h1>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-[10px] uppercase tracking-widest">LTV/CAC</span>
            <span className="font-bold font-heading text-emerald-400">32x</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-[10px] uppercase tracking-widest">TPS Scale</span>
            <span className="font-bold font-heading text-primary">1M</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-[10px] uppercase tracking-widest">Margin</span>
            <span className="font-bold font-heading text-emerald-400">+88%</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2">
        <Badge variant="success" className="h-5 text-[9px]">PRODUCTION</Badge>
        <div className="flex items-center gap-2">
          <Button variant="glow" size="pill">Synthesize</Button>
          <Button variant="outline" size="pill">Compare</Button>
          <Button variant="default" size="pill" className="bg-emerald-500 hover:bg-emerald-600 text-black border-0">$1.2M ASK</Button>
          <Button variant="glass" size="pill">Vault</Button>
        </div>
      </div>
    </div>
  )
}
