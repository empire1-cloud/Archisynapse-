export interface Position {
  x: number; y: number
}

export type ComponentType =
  | "user-interface" | "gateway" | "payment-processor" | "auth-provider"
  | "fraud-detection" | "database" | "cache" | "queue" | "analytics"
  | "ledger" | "cdn" | "compute" | "storage" | "network"
  | "wallet" | "fee-engine" | "subscription" | "marketplace"
  | "loyalty" | "reputation" | "compliance" | "notifications"

export interface ComponentMeta {
  defaultName: string
  category: "core" | "premium" | "gold" | "purple"
  icon: string
  tags: string[]
}

export const COMPONENT_METADATA: Record<ComponentType, ComponentMeta> = {
  "user-interface": { defaultName: "Interface", category: "core", icon: "LayoutDashboard", tags: ["frontend"] },
  gateway: { defaultName: "Gateway", category: "core", icon: "Shield", tags: ["networking", "security"] },
  "payment-processor": { defaultName: "Payment Rail", category: "premium", icon: "CreditCard", tags: ["payments", "revenue"] },
  "auth-provider": { defaultName: "Auth Service", category: "core", icon: "Key", tags: ["security", "identity"] },
  "fraud-detection": { defaultName: "Fraud Detection", category: "premium", icon: "ShieldCheck", tags: ["security", "ml"] },
  database: { defaultName: "Database", category: "core", icon: "Database", tags: ["storage", "persistence"] },
  cache: { defaultName: "Cache Layer", category: "core", icon: "Zap", tags: ["performance"] },
  queue: { defaultName: "Message Queue", category: "core", icon: "ArrowLeftRight", tags: ["async", "messaging"] },
  analytics: { defaultName: "Analytics Engine", category: "gold", icon: "ChartColumn", tags: ["insights", "data"] },
  ledger: { defaultName: "Immutable Ledger", category: "premium", icon: "BookOpen", tags: ["audit", "blockchain"] },
  cdn: { defaultName: "CDN", category: "core", icon: "Cloud", tags: ["networking", "performance"] },
  compute: { defaultName: "Compute", category: "core", icon: "Cpu", tags: ["infrastructure"] },
  storage: { defaultName: "Object Storage", category: "core", icon: "HardDrive", tags: ["storage"] },
  network: { defaultName: "Virtual Network", category: "core", icon: "Network", tags: ["networking"] },
  wallet: { defaultName: "Digital Wallet", category: "purple", icon: "Wallet", tags: ["payments", "fintech"] },
  "fee-engine": { defaultName: "Fee Engine", category: "gold", icon: "Percent", tags: ["monetization", "billing"] },
  subscription: { defaultName: "Subscription Manager", category: "gold", icon: "Repeat", tags: ["billing", "recurring"] },
  marketplace: { defaultName: "Marketplace API", category: "gold", icon: "Store", tags: ["commerce", "platform"] },
  loyalty: { defaultName: "Loyalty Engine", category: "purple", icon: "Heart", tags: ["retention", "rewards"] },
  reputation: { defaultName: "Reputation Service", category: "purple", icon: "ShieldCheck", tags: ["trust", "scoring"] },
  compliance: { defaultName: "Compliance Gateway", category: "premium", icon: "Scale", tags: ["security", "regulatory"] },
  notifications: { defaultName: "Notification Service", category: "core", icon: "Bell", tags: ["messaging"] },
}

export interface ArchComponent {
  id: string
  name: string
  type: ComponentType
  description: string
  config: Record<string, any>
  position: Position
  roiScore: number
  riskScore: number
  status: "healthy" | "degraded" | "failed"
  latency: number
  throughput: number
  techDebtScore: number
  isHighlighted?: boolean
  hasGovernanceGap?: boolean
}

export interface ArchDependency {
  id: string
  sourceId: string
  targetId: string
  type: "sync" | "async" | "event"
}

export interface Blueprint {
  id: string
  name: string
  version: string
  createdAt: string
  updatedAt: string
  components: ArchComponent[]
  dependencies: ArchDependency[]
}

export interface MarketEvent {
  title: string
  description: string
  affectedTypes: ComponentType[]
}
