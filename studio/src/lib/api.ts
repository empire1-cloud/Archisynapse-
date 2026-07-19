const DEFAULT_API_BASE = "http://127.0.0.1:3000/api/v1"
const API_BASE = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE
const DEMO_AUTH_HEADERS = {
  Authorization: "Bearer sk_test_123456789",
  "x-organization-id": "org_demo",
}

function buildUrl(path: string) {
  return `${API_BASE}${path}`
}

function buildHealthUrl() {
  return `${API_BASE.replace(/\/api\/v1\/?$/, "")}/health`
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...DEMO_AUTH_HEADERS,
      ...options?.headers,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body?.error?.message || body?.error || response.statusText)
  }

  return response.json()
}

export interface Blueprint {
  id: string
  slug: string
  name: string
  description: string
  tags: string[]
  category: string
  complexity: string
  inputs: string[]
  outputs: string[]
  components: string[]
  metrics: string[]
  bestPractices: string[]
}

export interface MatchResult {
  blueprint: Blueprint
  score: number
  graphScore: number
  tagScore: number
  textScore: number
  embeddingSimilarity: number
}

export interface GraphInfo {
  nodes: number
  edges: number
  edgeTypes: number
  edgeTypeBreakdown: Record<string, number>
  usageSignals: number
}

export interface BundleResult {
  name: string
  blueprints: { blueprint: Blueprint; connectivityScore: number }[]
  edgeCount: number
  avgConnectivity: number
}

export interface DashboardResponse {
  metrics: {
    total_transactions: number
    total_volume_cents: number
    total_volume_formatted: string
    success_rate_percent: number
    active_customers: number
    pending_payouts: number
    average_response_time_ms: number
  }
  status_breakdown: {
    succeeded: number
    failed: number
    pending: number
    refunded: number
  }
  recent_activity: Array<{
    id: string
    amount: number
    currency: string
    status: string
    description?: string
    created_at: string
  }>
  generated_at: string
}

export interface TrialBalanceAccount {
  accountNumber?: string
  accountName?: string
  debitSum: string
  creditSum: string
}

export interface TrialBalanceResponse {
  asOf: string
  accounts: TrialBalanceAccount[]
  totals: {
    debit: string
    credit: string
  }
  isBalanced: boolean
}

export interface PayoutRecord {
  id: string
  recipientAccountId?: string
  amount: number
  currency?: string
  status: string
  manualReviewRequired?: boolean
  riskDecision?: {
    id?: string
    decision?: string
    riskScore?: number
    reasons?: string[]
    createdAt?: string
  } | null
  metadata?: Record<string, unknown>
  failureReason?: string | null
  ledgerTransactionId?: string | null
  scheduledFor?: string | null
  sourceType?: string
  sourceReferenceId?: string | null
  processedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface HealthResponse {
  status: string
  timestamp: string
}

export interface RiskSummaryResponse {
  totalEvents: number
  averageRiskScore: number
  blockedPayoutEvents: number
  manualReviewEvents: number
  delayedPayoutEvents: number
  releasedPayoutEvents: number
}

export interface GraphRecommendation {
  blueprintId: string
  source: string
  reason?: string
  confidence?: number
  connectivityScore?: number
  blueprint: Blueprint
  sourceBlueprint: Blueprint
}

export const api = {
  health: () => fetchJSON<HealthResponse>(buildHealthUrl()),

  dashboard: () => fetchJSON<DashboardResponse>(buildUrl("/dashboard")),

  ledgerTrialBalance: () =>
    fetchJSON<TrialBalanceResponse>(buildUrl("/ledger/trial-balance")),

  listUnpostedPayouts: () =>
    fetchJSON<{ data: PayoutRecord[] }>(buildUrl("/payouts/unposted")),

  listPayouts: (params?: { status?: string; limit?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set("status", params.status)
    if (params?.limit) searchParams.set("limit", String(params.limit))
    return fetchJSON<{ data: PayoutRecord[]; total: number; nextCursor: string | null }>(
      buildUrl(`/payouts?${searchParams}`)
    )
  },

  releasePayout: (payoutId: string, note?: string) =>
    fetchJSON<PayoutRecord>(buildUrl(`/payouts/${payoutId}/release`), {
      method: "POST",
      body: JSON.stringify(note ? { note } : {}),
    }),

  riskSummary: () => fetchJSON<RiskSummaryResponse>(buildUrl("/risk/summary")),

  listBlueprints: (params?: { limit?: number; category?: string; tags?: string[] }) => {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set("limit", String(params.limit))
    if (params?.category) searchParams.set("category", params.category)
    if (params?.tags?.length) searchParams.set("tags", params.tags.join(","))
    return fetchJSON<{ items: Blueprint[]; total: number }>(buildUrl(`/blueprints?${searchParams}`))
  },

  matchBlueprints: (params: { query?: string; tags?: string[]; limit?: number }) => {
    const searchParams = new URLSearchParams()
    if (params.query) searchParams.set("query", params.query)
    if (params.tags?.length) searchParams.set("tags", params.tags.join(","))
    if (params.limit) searchParams.set("limit", String(params.limit))
    return fetchJSON<{ items: MatchResult[] }>(buildUrl(`/blueprints/semantic-match?${searchParams}`))
  },

  graphInfo: () => fetchJSON<GraphInfo>(buildUrl("/blueprints/graph/info")),

  graphNode: (id: string) => fetchJSON<unknown>(buildUrl(`/blueprints/graph/node/${id}`)),

  graphRelated: (id: string, params?: { limit?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set("limit", String(params.limit))
    return fetchJSON<{ items: unknown[] }>(buildUrl(`/blueprints/graph/related/${id}?${searchParams}`))
  },

  graphRecommendations: (seeds: string[], limit = 5) => {
    const searchParams = new URLSearchParams()
    searchParams.set("seeds", seeds.join(","))
    searchParams.set("limit", String(limit))
    return fetchJSON<{ items: GraphRecommendation[] }>(
      buildUrl(`/blueprints/graph/recommendations?${searchParams}`)
    )
  },

  graphBundle: (ids: string[], name?: string, description?: string) => {
    const searchParams = new URLSearchParams()
    searchParams.set("ids", ids.join(","))
    if (name) searchParams.set("name", name)
    if (description) searchParams.set("description", description)
    return fetchJSON<BundleResult>(buildUrl(`/blueprints/graph/bundle?${searchParams}`))
  },
}
