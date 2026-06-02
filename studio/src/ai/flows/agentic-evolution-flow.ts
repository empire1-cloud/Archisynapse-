"use client"

import { Blueprint, ArchComponent, ComponentType } from "@/types/architecture"

export type EvolutionPreset = "auto" | "roi" | "security" | "scale"

export interface ThresholdConfig {
  minROI: number
  maxRisk: number
  maxTechDebt: number
  aggression: "conservative" | "balanced" | "aggressive"
}

export interface DetectedIssue {
  type: "failure" | "governance-gap" | "missing-component" | "underperforming"
  severity: "low" | "medium" | "high"
  componentId?: string
  componentName?: string
  message: string
}

export interface RepairAction {
  action: "reset" | "add" | "remove" | "add-dependency"
  targetId?: string
  componentType?: ComponentType
  componentName?: string
  reason: string
}

export interface EvolutionResult {
  issues: DetectedIssue[]
  actions: RepairAction[]
  updatedBlueprint: Blueprint
}

export interface EvolutionRecord {
  id: string
  timestamp: string
  preset: EvolutionPreset
  aggression: string
  issues: number
  actions: number
  actionSummaries: string[]
}

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  minROI: 30,
  maxRisk: 70,
  maxTechDebt: 25,
  aggression: "balanced",
}

const COUNTERMEASURES: Record<string, { type: ComponentType; name: string; reason: string; tags: string[] }[]> = {
  "payment-processor": [
    { type: "fraud-detection", name: "Fraud Detection", reason: "Mitigate chargeback risk from payment processing", tags: ["security", "fintech"] },
    { type: "ledger", name: "Immutable Ledger", reason: "Audit trail for all payment transactions", tags: ["compliance", "fintech"] },
  ],
  "database": [
    { type: "cache", name: "Cache Layer", reason: "Reduce database read pressure and latency", tags: ["performance", "infra"] },
    { type: "queue", name: "Message Queue", reason: "Buffer write spikes to database", tags: ["resilience", "infra"] },
  ],
  "user-interface": [
    { type: "gateway", name: "Gateway", reason: "Add auth and rate limiting in front of UI", tags: ["security", "infra"] },
    { type: "cdn", name: "CDN", reason: "Global edge caching for UI assets", tags: ["performance", "infra"] },
  ],
  "auth-provider": [
    { type: "fraud-detection", name: "Fraud Detection", reason: "Detect compromised credentials and account takeover", tags: ["security"] },
    { type: "compliance", name: "Compliance Gateway", reason: "KYC/AML screening at authentication boundary", tags: ["security", "regulatory"] },
  ],
  "wallet": [
    { type: "ledger", name: "Immutable Ledger", reason: "Immutable audit trail for all wallet transactions", tags: ["compliance", "fintech"] },
    { type: "fee-engine", name: "Fee Engine", reason: "Automated fee collection on wallet operations", tags: ["revenue", "fintech"] },
  ],
  "analytics": [
    { type: "database", name: "Database", reason: "Persistent storage for analytics event data", tags: ["infra", "data"] },
    { type: "cache", name: "Cache Layer", reason: "Cache frequent dashboard queries", tags: ["performance"] },
  ],
  "subscription": [
    { type: "fee-engine", name: "Fee Engine", reason: "Billing calculation and invoice generation", tags: ["revenue", "billing"] },
    { type: "notifications", name: "Notification Service", reason: "Subscription renewal and payment alerts", tags: ["engagement"] },
  ],
  "queue": [
    { type: "compute", name: "Compute", reason: "Dedicated workers for queue consumption", tags: ["infra", "async"] },
  ],
  "marketplace": [
    { type: "reputation", name: "Reputation Service", reason: "Trust scoring for marketplace participants", tags: ["trust", "platform"] },
    { type: "fee-engine", name: "Fee Engine", reason: "Commission calculation on marketplace transactions", tags: ["revenue", "platform"] },
  ],
}

const RECOMMENDED: { type: ComponentType; name: string; reason: string; tags: string[] }[] = [
  { type: "analytics", name: "Analytics Engine", reason: "Enable revenue intelligence and usage metrics", tags: ["insight", "data"] },
  { type: "queue", name: "Message Queue", reason: "Decouple services for failure isolation", tags: ["resilience", "infra"] },
  { type: "notifications", name: "Notification Service", reason: "Real-time user alerts and webhooks", tags: ["engagement", "messaging"] },
  { type: "compliance", name: "Compliance Gateway", reason: "Automated KYC/AML and regulatory reporting", tags: ["security", "regulatory"] },
  { type: "loyalty", name: "Loyalty Engine", reason: "Customer retention and reward programs", tags: ["retention", "revenue"] },
  { type: "ledger", name: "Immutable Ledger", reason: "Immutable audit trail for financial operations", tags: ["compliance", "fintech"] },
]

let compCounter = 0
function nextCompId(): string { return `ev-c${++compCounter}_${Date.now()}` }

function severityWeight(s: "low" | "medium" | "high"): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1
}

function detectIssues(blueprint: Blueprint, thresholds: ThresholdConfig): DetectedIssue[] {
  const issues: DetectedIssue[] = []
  const types = blueprint.components.map(c => c.type)

  for (const comp of blueprint.components) {
    if (comp.status === "failed") {
      issues.push({ type: "failure", severity: "high", componentId: comp.id, componentName: comp.name, message: `${comp.name} is in failed state — cascading risk` })
    }
    if (comp.status === "degraded") {
      issues.push({ type: "failure", severity: "medium", componentId: comp.id, componentName: comp.name, message: `${comp.name} is degraded — throughput reduced` })
    }
    if (comp.roiScore < thresholds.minROI) {
      issues.push({ type: "underperforming", severity: comp.roiScore < 20 ? "high" : "medium", componentId: comp.id, componentName: comp.name, message: `${comp.name} has low ROI (${comp.roiScore}%)` })
    }
    if (comp.riskScore > thresholds.maxRisk) {
      issues.push({ type: "underperforming", severity: comp.riskScore > 80 ? "high" : "medium", componentId: comp.id, componentName: comp.name, message: `${comp.name} has critical risk exposure (${comp.riskScore})` })
    }
    if (comp.techDebtScore > thresholds.maxTechDebt) {
      issues.push({ type: "underperforming", severity: "low", componentId: comp.id, componentName: comp.name, message: `${comp.name} has high tech debt (${comp.techDebtScore})` })
    }
  }

  for (const [trigger, countermeasures] of Object.entries(COUNTERMEASURES)) {
    for (const cm of countermeasures) {
      if (types.includes(trigger as ComponentType) && !types.includes(cm.type)) {
        issues.push({
          type: "governance-gap",
          severity: cm.tags.includes("security") ? "high" : "medium",
          message: `${trigger.replace(/-/g, " ")} without ${cm.name} — ${cm.reason.toLowerCase()}`,
        })
      }
    }
  }

  const present = new Set(types)
  const addedRecs = new Set<string>()
  for (const rec of RECOMMENDED) {
    if (!present.has(rec.type) && !addedRecs.has(rec.type)) {
      addedRecs.add(rec.type)
      issues.push({ type: "missing-component", severity: "low", message: `No ${rec.name} — ${rec.reason}` })
    }
  }

  return issues
}

function severityFilter(issue: DetectedIssue, aggression: ThresholdConfig["aggression"]): boolean {
  if (aggression === "aggressive") return true
  if (aggression === "conservative") return severityWeight(issue.severity) >= 3
  return severityWeight(issue.severity) >= 2
}

function generateRepairPlan(blueprint: Blueprint, issues: DetectedIssue[], preset: EvolutionPreset): RepairAction[] {
  const actions: RepairAction[] = []
  const addedTypes = new Set(blueprint.components.map(c => c.type))
  const fixedIds = new Set<string>()

  const isPreset = (tags: string[]) => {
    if (preset === "auto") return true
    if (preset === "roi") return tags.some(t => ["revenue", "fintech", "insight", "billing", "platform", "engagement", "retention"].includes(t))
    if (preset === "security") return tags.some(t => ["security", "compliance", "regulatory", "trust"].includes(t))
    if (preset === "scale") return tags.some(t => ["performance", "infra", "resilience", "async", "data"].includes(t))
    return true
  }

  for (const issue of issues) {
    if (issue.type === "failure" && issue.componentId && !fixedIds.has(issue.componentId)) {
      fixedIds.add(issue.componentId)
      if (preset !== "security" || issue.severity === "high") {
        actions.push({ action: "reset", targetId: issue.componentId, reason: `Restore ${issue.componentName} to healthy state` })
      }
    }

    if (issue.type === "governance-gap") {
      for (const [trigger, countermeasures] of Object.entries(COUNTERMEASURES)) {
        for (const cm of countermeasures) {
          if (issue.message.startsWith(trigger) && !addedTypes.has(cm.type) && isPreset(cm.tags)) {
            addedTypes.add(cm.type)
            actions.push({ action: "add", componentType: cm.type, componentName: cm.name, reason: cm.reason })
          }
        }
      }
    }

    if (issue.type === "missing-component" && preset !== "security") {
      for (const rec of RECOMMENDED) {
        if (issue.message.includes(rec.name) && !addedTypes.has(rec.type) && isPreset(rec.tags)) {
          addedTypes.add(rec.type)
          actions.push({ action: "add", componentType: rec.type, componentName: rec.name, reason: rec.reason })
        }
      }
    }

    if (issue.type === "underperforming" && issue.componentId && !fixedIds.has(issue.componentId) && isPreset(["revenue", "infra"])) {
      if (issue.message.includes("critical risk") || issue.message.includes("low ROI")) {
        fixedIds.add(issue.componentId)
        if (!addedTypes.has("compliance") && preset !== "scale") {
          addedTypes.add("compliance")
          actions.push({ action: "add", componentType: "compliance", componentName: "Compliance Gateway", reason: "Add compliance oversight to reduce risk exposure" })
        }
      }
    }
  }

  return actions
}

function makeComponent(type: ComponentType, name: string, components: ArchComponent[]): ArchComponent {
  const offset = components.length * 25
  return {
    id: nextCompId(),
    name,
    type,
    description: `Auto-provisioned ${name} via Agentic Evolution`,
    config: {},
    position: { x: 400 + offset, y: 300 + offset },
    roiScore: Math.floor(55 + Math.random() * 35),
    riskScore: Math.floor(5 + Math.random() * 25),
    status: "healthy",
    latency: Math.floor(5 + Math.random() * 50),
    throughput: Math.floor(500 + Math.random() * 2500),
    techDebtScore: Math.floor(Math.random() * 15),
  }
}

export function analyzeBlueprint(
  blueprint: Blueprint,
  thresholdOverrides?: Partial<ThresholdConfig>,
  preset: EvolutionPreset = "auto"
): { issues: DetectedIssue[]; actions: RepairAction[] } {
  const thresholds: ThresholdConfig = { ...DEFAULT_THRESHOLDS, ...thresholdOverrides }
  const allIssues = detectIssues(blueprint, thresholds)
  const filtered = allIssues.filter(i => severityFilter(i, thresholds.aggression))
  const actions = generateRepairPlan(blueprint, filtered, preset)
  return { issues: filtered, actions }
}

export function applyActions(blueprint: Blueprint, actions: RepairAction[]): Blueprint {
  let updated = { ...blueprint, components: [...blueprint.components], dependencies: [...blueprint.dependencies] }

  for (const action of actions) {
    if (action.action === "reset" && action.targetId) {
      updated.components = updated.components.map(c =>
        c.id === action.targetId ? { ...c, status: "healthy" as const } : c
      )
    }
    if (action.action === "add" && action.componentType) {
      updated.components.push(makeComponent(action.componentType, action.componentName || action.componentType, updated.components))
    }
  }

  updated.updatedAt = new Date().toISOString()
  return updated
}

export async function runAgenticEvolution(
  blueprint: Blueprint,
  thresholdOverrides?: Partial<ThresholdConfig>,
  preset: EvolutionPreset = "auto"
): Promise<EvolutionResult> {
  const { issues, actions } = analyzeBlueprint(blueprint, thresholdOverrides, preset)
  const updatedBlueprint = applyActions(blueprint, actions)
  return { issues, actions, updatedBlueprint }
}
