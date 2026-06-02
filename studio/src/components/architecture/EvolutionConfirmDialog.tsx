"use client"

import { useState } from "react"
import { DetectedIssue, RepairAction } from "@/ai/flows/agentic-evolution-flow"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { AlertTriangle, CheckCircle, Shield, TrendingUp, RefreshCw } from "lucide-react"

interface EvolutionConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  issues: DetectedIssue[]
  actions: RepairAction[]
  onConfirm: (selected: RepairAction[]) => void
}

function IssueIcon({ type }: { type: DetectedIssue["type"] }) {
  if (type === "failure") return <AlertTriangle size={10} className="text-red-400" />
  if (type === "governance-gap") return <Shield size={10} className="text-orange-400" />
  if (type === "underperforming") return <TrendingUp size={10} className="text-yellow-400" />
  return <RefreshCw size={10} className="text-blue-400" />
}

function SeverityDot({ severity }: { severity: DetectedIssue["severity"] }) {
  return (
    <span className={cn(
      "w-1.5 h-1.5 rounded-full shrink-0",
      severity === "high" ? "bg-red-400" :
      severity === "medium" ? "bg-orange-400" : "bg-blue-400"
    )} />
  )
}

export function EvolutionConfirmDialog({ open, onOpenChange, issues, actions, onConfirm }: EvolutionConfirmDialogProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set(actions.map((_, i) => i)))

  const toggleAction = (idx: number) => {
    const next = new Set(selected)
    if (next.has(idx)) next.delete(idx); else next.add(idx)
    setSelected(next)
  }

  const selectedActions = actions.filter((_, i) => selected.has(i))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col glass-panel bg-background/80 backdrop-blur-3xl border-white/10">
        <DialogHeader>
          <DialogTitle className="font-headline text-lg flex items-center gap-2">
            <RefreshCw size={16} className="text-accent" /> Evolution Plan
          </DialogTitle>
          <DialogDescription>
            {issues.length} issue{issues.length !== 1 ? "s" : ""} detected · {actions.length} action{actions.length !== 1 ? "s" : ""} proposed
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4 py-2">
          <div>
            <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Detected Issues</h4>
            <ScrollArea className="max-h-[120px]">
              <div className="space-y-1 pr-2">
                {issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <IssueIcon type={issue.type} />
                    <SeverityDot severity={issue.severity} />
                    <span className="text-[10px] text-muted-foreground leading-relaxed">{issue.message}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div>
            <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Proposed Actions</h4>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1 pr-2">
                {actions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => toggleAction(i)}
                    className={cn(
                      "w-full flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all",
                      selected.has(i)
                        ? "bg-accent/5 border-accent/20"
                        : "bg-white/[0.02] border-white/5 opacity-50"
                    )}
                  >
                    <CheckCircle
                      size={12}
                      className={cn(
                        "mt-0.5 shrink-0 transition-colors",
                        selected.has(i) ? "text-emerald-400" : "text-muted-foreground/30"
                      )}
                    />
                    <div className="min-w-0">
                      <span className={cn(
                        "text-[10px] font-semibold block leading-tight",
                        selected.has(i) ? "text-accent" : "text-muted-foreground"
                      )}>
                        {action.action === "reset" ? `Reset ${action.targetId?.slice(0, 8)}` :
                         action.action === "add" ? `Add ${action.componentName || action.componentType}` :
                         action.action}
                      </span>
                      <span className="text-[8px] text-muted-foreground/60 block mt-0.5">{action.reason}</span>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="rounded-xl text-[9px]">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => { onConfirm(selectedActions); onOpenChange(false) }}
            disabled={selectedActions.length === 0}
            className="rounded-xl text-[9px] bg-accent text-black hover:bg-accent/90"
          >
            Apply {selectedActions.length > 0 && `(${selectedActions.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
