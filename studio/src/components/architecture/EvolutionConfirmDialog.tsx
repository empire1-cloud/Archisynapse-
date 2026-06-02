"use client"

import { DetectedIssue, RepairAction } from "@/ai/flows/agentic-evolution-flow"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export interface EvolutionActionItem {
  id: number
  label: string
  component: string
  selected: boolean
}

interface EvolutionConfirmDialogProps {
  open: boolean
  issues: DetectedIssue[]
  actions: EvolutionActionItem[]
  onToggleAction: (id: number) => void
  onClose: () => void
  onApply: () => void
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: "#d32f2f", text: "#fff" },
  high: { bg: "#f57c00", text: "#fff" },
  medium: { bg: "#1976d2", text: "#fff" },
  low: { bg: "#616161", text: "#fff" },
}

const TYPE_LABELS: Record<string, string> = {
  failure: "Failure",
  "governance-gap": "Governance",
  "missing-component": "Missing",
  underperforming: "Performance",
}

export function EvolutionConfirmDialog({ open, issues, actions, onToggleAction, onClose, onApply }: EvolutionConfirmDialogProps) {
  const selectedCount = actions.filter(a => a.selected).length

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col glass-panel bg-background/80 backdrop-blur-3xl border-white/10">
        <DialogHeader>
          <DialogTitle className="font-headline text-lg">Evolution Preview</DialogTitle>
          <DialogDescription>
            {issues.length} issue{issues.length !== 1 ? "s" : ""} detected · {actions.length} action{actions.length !== 1 ? "s" : ""} proposed
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4 py-2">
          <div>
            <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Detected Issues</h4>
            <ScrollArea className="max-h-[140px]">
              <div className="space-y-1.5 pr-2">
                {issues.map((issue, i) => {
                  const colors = SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.low
                  return (
                    <div key={i} className="flex items-start gap-2 py-0.5">
                      <span
                        className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded leading-none mt-0.5"
                        style={{ background: colors.bg, color: colors.text }}
                      >
                        {issue.severity}
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-relaxed">{issue.message}</span>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>

          <div>
            <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Proposed Actions</h4>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1 pr-2">
                {actions.map(action => (
                  <button
                    key={action.id}
                    onClick={() => onToggleAction(action.id)}
                    className={cn(
                      "w-full flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all",
                      action.selected
                        ? "bg-accent/5 border-accent/20"
                        : "bg-white/[0.02] border-white/5 opacity-40"
                    )}
                  >
                    <span
                      className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center mt-0.5 shrink-0 transition-colors",
                        action.selected
                          ? "bg-accent border-accent"
                          : "border-white/20"
                      )}
                    >
                      {action.selected && <span className="w-2 h-2 rounded-sm bg-black" />}
                    </span>
                    <div className="min-w-0">
                      <span className={cn(
                        "text-[10px] font-semibold block leading-tight",
                        action.selected ? "text-accent" : "text-muted-foreground"
                      )}>
                        {action.label} <span className="font-mono text-muted-foreground/60">({action.component})</span>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl text-[9px]">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onApply}
            disabled={selectedCount === 0}
            className="rounded-xl text-[9px] bg-accent text-black hover:bg-accent/90"
          >
            Apply ({selectedCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
