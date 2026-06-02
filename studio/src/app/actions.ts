"use server"

import { api } from "@/lib/api"

export async function generateStrategyBlueprint(goal: string) {
  const result = await api.matchBlueprints({ query: goal, limit: 3 })
  return result
}

export async function compareStrategies(baselineId: string, alternativeId: string) {
  const [baseline, alternative] = await Promise.all([
    api.graphNode(baselineId).catch(() => null),
    api.graphNode(alternativeId).catch(() => null),
  ])
  return { baseline, alternative }
}

export async function generateExecutiveBriefing(blueprintId: string) {
  const [node, related] = await Promise.all([
    api.graphNode(blueprintId).catch(() => null),
    api.graphRelated(blueprintId, { limit: 3 }).catch(() => ({ items: [] })),
  ])
  return { node, related: related.items }
}

export async function generateMarketEvent() {
  const info = await api.graphInfo().catch(() => null)
  return {
    event: "Market Signal Detected",
    severity: "medium",
    detail: "Emerging market clearing protocols shifting — infrastructure hardening recommended.",
    timestamp: new Date().toISOString(),
    graphNodes: info?.nodes || 0,
    graphEdges: info?.edges || 0,
  }
}
