import {
  Cpu, HardDrive, Globe, Database, Layers, Zap, ShieldCheck,
  Box, Monitor, BarChart3, CreditCard, Wind, Key, Percent,
  Wallet, Fingerprint, Repeat, Activity, FileText, TrendingUp,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface ComponentType {
  id: string
  name: string
  icon: LucideIcon
  color: string
  category: "CORE" | "GOLD" | "PREMIUM" | "PURPLE"
  unitEconomics: string
}

export const COMPONENT_TYPES: ComponentType[] = [
  { id: "auth-provider", name: "IAM Identity Hub", icon: Key, color: "amber", category: "CORE", unitEconomics: "Trust-Center" },
  { id: "payment-processor", name: "Digital Wallet Rail", icon: CreditCard, color: "green", category: "CORE", unitEconomics: "Direct-MRR" },
  { id: "fraud-detection", name: "ML Risk Sentinel", icon: ShieldCheck, color: "red", category: "CORE", unitEconomics: "Risk-Yield" },
  { id: "user-interface", name: "Merchant Dashboard", icon: Monitor, color: "pink", category: "CORE", unitEconomics: "Growth-Center" },
  { id: "billing-service", name: "Billing Service", icon: FileText, color: "blue", category: "GOLD", unitEconomics: "Settlement-Rail" },
  { id: "commission-calc", name: "Commission Engine", icon: Percent, color: "amber", category: "GOLD", unitEconomics: "Platform-Fee" },
  { id: "fee-collector", name: "Fee Engine", icon: TrendingUp, color: "emerald", category: "GOLD", unitEconomics: "Core-MRR" },
  { id: "marketplace-api", name: "Marketplace API", icon: Globe, color: "indigo", category: "GOLD", unitEconomics: "TAM-Multiplier" },
  { id: "subscription-mgr", name: "Subscription Manager", icon: Repeat, color: "emerald", category: "GOLD", unitEconomics: "MRR-Stabilizer" },
  { id: "usage-tracker", name: "Usage Tracker", icon: Activity, color: "yellow", category: "GOLD", unitEconomics: "Consumption-ROI" },
  { id: "white-label-hub", name: "White-Label Hub", icon: Globe, color: "purple", category: "GOLD", unitEconomics: "Expansion-License" },
  { id: "dna-tagger", name: "DNA Tagging", icon: Fingerprint, color: "indigo", category: "PREMIUM", unitEconomics: "Attribution-Moat" },
  { id: "lyrica-rail", name: "Lyrica Clearing Rail", icon: Activity, color: "cyan", category: "PREMIUM", unitEconomics: "System-Control" },
  { id: "soulfire-engine", name: "Soulfire Engine", icon: Zap, color: "red", category: "PREMIUM", unitEconomics: "IP-Generator" },
  { id: "sla113-os", name: "SLA113 Core OS", icon: Cpu, color: "cyan", category: "PREMIUM", unitEconomics: "System-Control" },
  { id: "empire1-wallet", name: "Empire1 Wallet", icon: Wallet, color: "amber", category: "PURPLE", unitEconomics: "Financial-Hub" },
  { id: "loyalty-engine", name: "Loyalty Engine", icon: Zap, color: "pink", category: "PURPLE", unitEconomics: "Retention-Yield" },
  { id: "micro-royalties", name: "Micro-Royalty", icon: Percent, color: "cyan", category: "PURPLE", unitEconomics: "Retention-Multiplier" },
  { id: "reputation-svc", name: "Reputation Service", icon: ShieldCheck, color: "emerald", category: "PURPLE", unitEconomics: "Trust-Asset" },
]

export function getComponentType(id: string) {
  return COMPONENT_TYPES.find(c => c.id === id)
}

export const COLOR_MAP: Record<string, string> = {
  cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  green: "border-green-500/30 bg-green-500/10 text-green-400",
  red: "border-red-500/30 bg-red-500/10 text-red-400",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  pink: "border-pink-500/30 bg-pink-500/10 text-pink-400",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  indigo: "border-indigo-500/30 bg-indigo-500/10 text-indigo-400",
  purple: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  yellow: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
}

export const CATEGORY_COLORS: Record<string, string> = {
  CORE: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  GOLD: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  PREMIUM: "text-purple-400 border-purple-500/30 bg-purple-500/10",
  PURPLE: "text-pink-400 border-pink-500/30 bg-pink-500/10",
}
