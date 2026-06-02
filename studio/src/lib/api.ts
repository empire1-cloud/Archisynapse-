const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://archisynapse-production.up.railway.app/api/v1"

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message || res.statusText)
  }
  return res.json()
}

export interface Blueprint {
  id: string; slug: string; name: string; description: string
  tags: string[]; category: string; complexity: string
  inputs: string[]; outputs: string[]; components: string[]
  metrics: string[]; bestPractices: string[]
}

export interface MatchResult {
  blueprint: Blueprint; score: number; graphScore: number
  semanticScore: number; tagScore: number; textMatchScore: number
}

export interface GraphInfo {
  nodes: number; edges: number; edgeTypes: number
  edgeTypeBreakdown: Record<string, number>; usageSignals: number
}

export interface BundleResult {
  name: string; blueprints: { blueprint: Blueprint; connectivityScore: number }[]
  edgeCount: number; avgConnectivity: number
}

export const api = {
  health: () => fetchAPI<{ status: string }>("/health"),

  listBlueprints: (params?: { limit?: number; category?: string; tags?: string[] }) => {
    const sp = new URLSearchParams()
    if (params?.limit) sp.set("limit", String(params.limit))
    if (params?.category) sp.set("category", params.category)
    if (params?.tags?.length) sp.set("tags", params.tags.join(","))
    return fetchAPI<{ items: Blueprint[]; total: number }>(`/blueprints?${sp}`)
  },

  matchBlueprints: (params: { query?: string; tags?: string[]; limit?: number }) => {
    const sp = new URLSearchParams()
    if (params.query) sp.set("query", params.query)
    if (params.tags?.length) sp.set("tags", params.tags.join(","))
    if (params.limit) sp.set("limit", String(params.limit))
    return fetchAPI<{ items: MatchResult[] }>(`/blueprints/semantic-match?${sp}`)
  },

  graphInfo: () => fetchAPI<GraphInfo>("/blueprints/graph/info"),
  graphNode: (id: string) => fetchAPI<any>(`/blueprints/graph/node/${id}`),
  graphRelated: (id: string, params?: { limit?: number }) => {
    const sp = new URLSearchParams()
    if (params?.limit) sp.set("limit", String(params.limit))
    return fetchAPI<{ items: any[] }>(`/blueprints/graph/related/${id}?${sp}`)
  },
  graphRecommendations: (seeds: string[]) => {
    const sp = new URLSearchParams()
    sp.set("seeds", seeds.join(","))
    return fetchAPI<{ items: MatchResult[] }>(`/blueprints/graph/recommendations?${sp}`)
  },
  graphBundle: (ids: string[], name?: string, description?: string) => {
    const sp = new URLSearchParams()
    sp.set("ids", ids.join(","))
    if (name) sp.set("name", name)
    if (description) sp.set("description", description)
    return fetchAPI<BundleResult>(`/blueprints/graph/bundle?${sp}`)
  },
}
