import {
  Cpu, Zap, ShieldCheck, Key, CreditCard, Monitor, Fingerprint,
  Wallet, Percent, Repeat, Activity, FileText, TrendingUp, Globe,
  Box, Database, HardDrive, Layers, Network, Lock, ArrowLeftRight,
  BarChart3, Cloud, Book, Server,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface ComponentType {
  id: string
  name: string
  slug: string
  icon: LucideIcon
  color: string
  stack: "PREMIUM" | "PURPLE" | "GOLD" | "CORE"
}

const CYAN = "cyan"
const RED = "red"
const INDIGO = "indigo"
const AMBER = "amber"
const PINK = "pink"
const EMERALD = "emerald"
const GREEN = "green"
const BLUE = "blue"
const PURPLE = "purple"
const YELLOW = "yellow"
const ORANGE = "orange"

export const COMPONENT_TYPES: ComponentType[] = [
  { id: "sla113-os", name: "SLA113 Core OS", slug: "sla113-os", icon: Cpu, color: CYAN, stack: "PREMIUM" },
  { id: "soulfire-engine", name: "Soulfire Engine", slug: "soulfire-engine", icon: Zap, color: RED, stack: "PREMIUM" },
  { id: "dna-tagger", name: "DNA Tagging", slug: "dna-tagger", icon: Fingerprint, color: INDIGO, stack: "PREMIUM" },
  { id: "lyrica-rail", name: "Lyrica Clearing Rail", slug: "lyrica-rail", icon: Activity, color: CYAN, stack: "PREMIUM" },

  { id: "micro-royalties", name: "Micro-Royalty", slug: "micro-royalties", icon: Percent, color: CYAN, stack: "PURPLE" },
  { id: "empire1-wallet", name: "Empire1 Wallet", slug: "empire1-wallet", icon: Wallet, color: AMBER, stack: "PURPLE" },
  { id: "loyalty-engine", name: "Loyalty Engine", slug: "loyalty-engine", icon: Zap, color: PINK, stack: "PURPLE" },
  { id: "reputation-svc", name: "Reputation Service", slug: "reputation-svc", icon: ShieldCheck, color: EMERALD, stack: "PURPLE" },

  { id: "fee-collector", name: "Fee Engine", slug: "fee-collector", icon: TrendingUp, color: EMERALD, stack: "GOLD" },
  { id: "subscription-mgr", name: "Subscription Manager", slug: "subscription-mgr", icon: Repeat, color: EMERALD, stack: "GOLD" },
  { id: "usage-tracker", name: "Usage Tracker", slug: "usage-tracker", icon: Activity, color: YELLOW, stack: "GOLD" },
  { id: "billing-service", name: "Billing Service", slug: "billing-service", icon: FileText, color: BLUE, stack: "GOLD" },
  { id: "white-label-hub", name: "White-Label Hub", slug: "white-label-hub", icon: Globe, color: PURPLE, stack: "GOLD" },
  { id: "marketplace-api", name: "Marketplace API", slug: "marketplace-api", icon: Globe, color: INDIGO, stack: "GOLD" },
  { id: "commission-calc", name: "Commission Engine", slug: "commission-calc", icon: Percent, color: AMBER, stack: "GOLD" },

  { id: "compute-instance", name: "Compute Instance", slug: "compute", icon: Cpu, color: BLUE, stack: "CORE" },
  { id: "storage", name: "S3 Record Vault", slug: "storage", icon: HardDrive, color: BLUE, stack: "CORE" },
  { id: "network", name: "Isolated VPC", slug: "network", icon: Network, color: BLUE, stack: "CORE" },
  { id: "database", name: "SQL Merchant DB", slug: "database", icon: Database, color: BLUE, stack: "CORE" },
  { id: "queue", name: "Kafka Event Broker", slug: "queue", icon: ArrowLeftRight, color: BLUE, stack: "CORE" },
  { id: "cache", name: "Redis State Cache", slug: "cache", icon: Server, color: BLUE, stack: "CORE" },
  { id: "gateway", name: "Compliance Gateway", slug: "gateway", icon: Lock, color: BLUE, stack: "CORE" },
  { id: "service", name: "Transaction Service", slug: "service", icon: Box, color: BLUE, stack: "CORE" },
  { id: "user-interface", name: "Merchant Dashboard", slug: "user-interface", icon: Monitor, color: PINK, stack: "CORE" },
  { id: "analytics", name: "Neural Analytics", slug: "analytics", icon: BarChart3, color: BLUE, stack: "CORE" },
  { id: "payment-processor", name: "Digital Wallet Rail", slug: "payment-processor", icon: CreditCard, color: GREEN, stack: "CORE" },
  { id: "cdn", name: "Global Edge CDN", slug: "cdn", icon: Cloud, color: BLUE, stack: "CORE" },
  { id: "auth-provider", name: "IAM Identity Hub", slug: "auth-provider", icon: Key, color: AMBER, stack: "CORE" },
  { id: "ledger", name: "Immutable Ledger", slug: "ledger", icon: Book, color: BLUE, stack: "CORE" },
  { id: "fraud-detection", name: "ML Risk Sentinel", slug: "fraud-detection", icon: ShieldCheck, color: RED, stack: "CORE" },
]

export function getComponentType(id: string) {
  return COMPONENT_TYPES.find(c => c.id === id || c.slug === id)
}

export const STACK_ORDER = ["PREMIUM", "PURPLE", "GOLD", "CORE"] as const

export const STACK_COLORS: Record<string, string> = {
  PREMIUM: "text-purple-400 border-purple-500/30",
  PURPLE: "text-pink-400 border-pink-500/30",
  GOLD: "text-amber-400 border-amber-500/30",
  CORE: "text-blue-400 border-blue-500/30",
}

export const COMPONENT_COLORS: Record<string, string> = {
  cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  red: "border-red-500/30 bg-red-500/10 text-red-400",
  indigo: "border-indigo-500/30 bg-indigo-500/10 text-indigo-400",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  pink: "border-pink-500/30 bg-pink-500/10 text-pink-400",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  green: "border-green-500/30 bg-green-500/10 text-green-400",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  purple: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  yellow: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  orange: "border-orange-500/30 bg-orange-500/10 text-orange-400",
}
