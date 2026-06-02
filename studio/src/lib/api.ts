const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://archisynapse-production.up.railway.app/api/v1"

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = "APIError"
  }
}

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new APIError(res.status, body?.error?.message || res.statusText)
  }
  return res.json()
}

export interface Blueprint {
  id: string
  slug: string
  name: string
  description: string
  tags: string[]
  category: string
  complexity: "low" | "medium" | "high"
  scoreWeights: Record<string, number>
  inputs: string[]
  outputs: string[]
  components: string[]
  metrics: string[]
  bestPractices: string[]
  exampleUseCases: string[]
  version: string
  createdAt: string
  updatedAt: string
}

export interface MatchResult {
  blueprint: Blueprint
  score: number
  graphScore: number
  tagScore: number
  textMatchScore: number
  semanticScore: number
}

export interface GraphInfo {
  nodes: number
  edges: number
  edgeTypes: number
  edgeTypeBreakdown: Record<string, number>
  usageSignals: number
}

export interface GraphEdge {
  id: string
  fromId: string
  toId: string
  type: string
  confidence: number
  source: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface GraphNode {
  blueprint: Blueprint
  edges: GraphEdge[]
  degree: number
  connectivityScore: number
}

export interface BundleResult {
  name: string
  description: string
  blueprints: { blueprint: Blueprint; connectivityScore: number }[]
  edgeCount: number
  avgConnectivity: number
}

export interface DashboardMetrics {
  totalBlueprints: number
  totalCustomers: number
  totalTransactions: number
  totalRevenue: number
  recentTransactions: { id: string; amount: number; status: string; createdAt: string }[]
}

export const api = {
  health: () => fetchAPI<{ status: string; timestamp: string }>("/health"),

  listBlueprints: (params?: { limit?: number; offset?: number; category?: string; tags?: string[]; complexity?: string }) => {
    const sp = new URLSearchParams()
    if (params?.limit) sp.set("limit", String(params.limit))
    if (params?.offset) sp.set("offset", String(params.offset))
    if (params?.category) sp.set("category", params.category)
    if (params?.tags?.length) sp.set("tags", params.tags.join(","))
    if (params?.complexity) sp.set("complexity", params.complexity)
    return fetchAPI<{ items: Blueprint[]; total: number }>(`/blueprints?${sp}`)
  },

  getBlueprint: (id: string) => fetchAPI<Blueprint>(`/blueprints/${id}`),

  getBlueprintBySlug: (slug: string) => fetchAPI<Blueprint>(`/blueprints/slug/${slug}`),

  matchBlueprints: (params: { query?: string; tags?: string[]; category?: string; complexity?: string; limit?: number }) => {
    const sp = new URLSearchParams()
    if (params.query) sp.set("query", params.query)
    if (params.tags?.length) sp.set("tags", params.tags.join(","))
    if (params.category) sp.set("category", params.category)
    if (params.complexity) sp.set("complexity", params.complexity)
    if (params.limit) sp.set("limit", String(params.limit))
    return fetchAPI<{ items: MatchResult[] }>(`/blueprints/semantic-match?${sp}`)
  },

  graphInfo: () => fetchAPI<GraphInfo>("/blueprints/graph/info"),

  graphNode: (id: string) => fetchAPI<GraphNode>(`/blueprints/graph/node/${id}`),

  graphEdges: (id: string) => fetchAPI<{ edges: GraphEdge[] }>(`/blueprints/graph/edges/${id}`),

  graphRelated: (id: string, params?: { limit?: number; minConfidence?: number }) => {
    const sp = new URLSearchParams()
    if (params?.limit) sp.set("limit", String(params.limit))
    if (params?.minConfidence) sp.set("minConfidence", String(params.minConfidence))
    return fetchAPI<{ items: { blueprint: Blueprint; score: number; edgeType: string; confidence: number }[] }>(`/blueprints/graph/related/${id}?${sp}`)
  },

  graphRecommendations: (seeds: string[], params?: { limit?: number; minConfidence?: number }) => {
    const sp = new URLSearchParams()
    sp.set("seeds", seeds.join(","))
    if (params?.limit) sp.set("limit", String(params.limit))
    if (params?.minConfidence) sp.set("minConfidence", String(params.minConfidence))
    return fetchAPI<{ items: MatchResult[] }>(`/blueprints/graph/recommendations?${sp}`)
  },

  graphBundle: (ids: string[], name?: string, description?: string) => {
    const sp = new URLSearchParams()
    sp.set("ids", ids.join(","))
    if (name) sp.set("name", name)
    if (description) sp.set("description", description)
    return fetchAPI<BundleResult>(`/blueprints/graph/bundle?${sp}`)
  },

  dashboard: () => fetchAPI<DashboardMetrics>("/dashboard"),
}
