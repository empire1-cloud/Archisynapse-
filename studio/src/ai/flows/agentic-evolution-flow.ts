"use client"

import { Blueprint, ArchComponent, ComponentType } from "@/types/architecture"

export type EvolutionPreset = "auto" | "roi" | "security" | "scale"

export interface ThresholdConfig {
  minROI: number
  maxRisk: number
  maxTechDebt: number
  aggression: "safe" | "balanced" | "aggressive"
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

export interface MetricSnapshot {
  avgROI: number
  totalRisk: number
  totalDebt: number
  componentCount: number
  healthyCount: number
}

export interface EvolutionRecord {
  id: string
  timestamp: string
  preset: EvolutionPreset
  aggression: string
  issues: number
  actions: number
  actionSummaries: string[]
  before: MetricSnapshot
  after: MetricSnapshot
  delta: {
    roi: number
    risk: number
    debt: number
    health: number
  }
}

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  minROI: 30,
  maxRisk: 70,
  maxTechDebt: 25,
  aggression: "balanced",
}

const PRESET_COMPONENTS: Record<EvolutionPreset, ComponentType[] | "all"> = {
  auto: "all",
  roi: ["fee-engine", "subscription", "analytics", "marketplace", "loyalty"],
  security: ["fraud-detection", "compliance", "gateway"],
  scale: ["cache", "queue", "cdn", "compute"],
}

const COUNTERMEASURES: Record<string, { type: ComponentType; name: string; reason: string }[]> = {
  "payment-processor": [
    { type: "fraud-detection", name: "Fraud Detection", reason: "Mitigate chargeback risk from payment processing" },
    { type: "ledger", name: "Immutable Ledger", reason: "Audit trail for all payment transactions" },
  ],
  "database": [
    { type: "cache", name: "Cache Layer", reason: "Reduce database read pressure and latency" },
    { type: "queue", name: "Message Queue", reason: "Buffer write spikes to database" },
  ],
  "user-interface": [
    { type: "gateway", name: "Gateway", reason: "Add auth and rate limiting in front of UI" },
    { type: "cdn", name: "CDN", reason: "Global edge caching for UI assets" },
  ],
  "auth-provider": [
    { type: "fraud-detection", name: "Fraud Detection", reason: "Detect compromised credentials and account takeover" },
    { type: "compliance", name: "Compliance Gateway", reason: "KYC/AML screening at authentication boundary" },
  ],
  wallet: [
    { type: "ledger", name: "Immutable Ledger", reason: "Immutable audit trail for all wallet transactions" },
    { type: "fee-engine", name: "Fee Engine", reason: "Automated fee collection on wallet operations" },
  ],
  analytics: [
    { type: "database", name: "Database", reason: "Persistent storage for analytics event data" },
    { type: "cache", name: "Cache Layer", reason: "Cache frequent dashboard queries" },
  ],
  subscription: [
    { type: "fee-engine", name: "Fee Engine", reason: "Billing calculation and invoice generation" },
    { type: "notifications", name: "Notification Service", reason: "Subscription renewal and payment alerts" },
  ],
  queue: [
    { type: "compute", name: "Compute", reason: "Dedicated workers for queue consumption" },
  ],
  marketplace: [
    { type: "reputation", name: "Reputation Service", reason: "Trust scoring for marketplace participants" },
    { type: "fee-engine", name: "Fee Engine", reason: "Commission calculation on marketplace transactions" },
  ],
}

const RECOMMENDED: { type: ComponentType; name: string; reason: string }[] = [
  { type: "analytics", name: "Analytics Engine", reason: "Enable revenue intelligence and usage metrics" },
  { type: "queue", name: "Message Queue", reason: "Decouple services for failure isolation" },
  { type: "notifications", name: "Notification Service", reason: "Real-time user alerts and webhooks" },
  { type: "compliance", name: "Compliance Gateway", reason: "Automated KYC/AML and regulatory reporting" },
  { type: "loyalty", name: "Loyalty Engine", reason: "Customer retention and reward programs" },
  { type: "ledger", name: "Immutable Ledger", reason: "Immutable audit trail for financial operations" },
]

let compCounter = 0
function nextCompId(): string { return `ev-c${++compCounter}_${Date.now()}` }

function severityWeight(s: "low" | "medium" | "high"): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1
}

function componentInPreset(type: ComponentType, preset: EvolutionPreset): boolean {
  const allowed = PRESET_COMPONENTS[preset]
  if (allowed === "all") return true
  return allowed.includes(type)
}

function governanceSeverity(trigger: string): "high" | "medium" {
  const HIGH_RISK = ["payment-processor", "user-interface", "auth-provider", "wallet"]
  return HIGH_RISK.includes(trigger) ? "high" : "medium"
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
          severity: governanceSeverity(trigger),
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
  if (aggression === "safe") return severityWeight(issue.severity) >= 3
  return severityWeight(issue.severity) >= 2
}

function generateRepairPlan(blueprint: Blueprint, issues: DetectedIssue[], preset: EvolutionPreset): RepairAction[] {
  const actions: RepairAction[] = []
  const addedTypes = new Set(blueprint.components.map(c => c.type))
  const fixedIds = new Set<string>()

  for (const issue of issues) {
    if (issue.type === "failure" && issue.componentId && !fixedIds.has(issue.componentId)) {
      fixedIds.add(issue.componentId)
      actions.push({ action: "reset", targetId: issue.componentId, reason: `Restore ${issue.componentName} to healthy state` })
    }

    if (issue.type === "governance-gap") {
      for (const [trigger, countermeasures] of Object.entries(COUNTERMEASURES)) {
        for (const cm of countermeasures) {
          if (issue.message.startsWith(trigger) && !addedTypes.has(cm.type) && componentInPreset(cm.type, preset)) {
            addedTypes.add(cm.type)
            actions.push({ action: "add", componentType: cm.type, componentName: cm.name, reason: cm.reason })
          }
        }
      }
    }

    if (issue.type === "missing-component") {
      for (const rec of RECOMMENDED) {
        if (issue.message.includes(rec.name) && !addedTypes.has(rec.type) && componentInPreset(rec.type, preset)) {
          addedTypes.add(rec.type)
          actions.push({ action: "add", componentType: rec.type, componentName: rec.name, reason: rec.reason })
        }
      }
    }

    if (issue.type === "underperforming" && issue.componentId && !fixedIds.has(issue.componentId)) {
      if (issue.message.includes("critical risk") || issue.message.includes("low ROI")) {
        fixedIds.add(issue.componentId)
        if (!addedTypes.has("compliance") && componentInPreset("compliance", preset)) {
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

export function snapshotMetrics(components: ArchComponent[]): MetricSnapshot {
  const count = components.length || 1
  return {
    avgROI: Math.round(components.reduce((a, c) => a + (c.roiScore || 50), 0) / count),
    totalRisk: components.reduce((a, c) => a + (c.riskScore || 20), 0),
    totalDebt: components.reduce((a, c) => a + (c.techDebtScore || 0), 0),
    componentCount: components.length,
    healthyCount: components.filter(c => c.status === "healthy").length,
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
