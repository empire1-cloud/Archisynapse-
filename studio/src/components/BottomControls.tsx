"use client"

import { Play, ShieldAlert, Shield, TrendingUp, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BottomControlsProps {
  onDeploy: () => void
  onSimulate: () => void
  onHarden: () => void
  onOptimize: () => void
  deploying: boolean
  simulating: boolean
}

export function BottomControls({ onDeploy, onSimulate, onHarden, onOptimize, deploying, simulating }: BottomControlsProps) {
  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-3xl px-10 py-4 flex items-center gap-6 z-[100] shadow-2xl ring-1 ring-white/10 bg-background/60 backdrop-blur-xl">
      <Button variant="default" size="sm" onClick={onDeploy} disabled={deploying}>
        {deploying ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Play className="h-3 w-3 mr-2" />}
        Deploy
      </Button>

      <Button variant="secondary" size="sm" onClick={onSimulate} disabled={simulating}>
        {simulating ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <ShieldAlert className="h-3 w-3 mr-2" />}
        Simulate Failure
      </Button>

      <Button variant="secondary" size="sm" onClick={onHarden}>
        <Shield className="h-3 w-3 mr-2" />
        Harden Security
      </Button>

      <Button variant="secondary" size="sm" onClick={onOptimize}>
        <TrendingUp className="h-3 w-3 mr-2" />
        Optimize ROI
      </Button>
    </div>
  )
}
