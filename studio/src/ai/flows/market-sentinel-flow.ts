import { MarketEvent, ComponentType } from "@/types/architecture"

const marketEvents: MarketEvent[] = [
  {
    title: "New PCI-DSS 4.0 Compliance Deadline",
    description: "Updated payment security standards require enhanced encryption and access controls by Q3.",
    affectedTypes: ["payment-processor", "gateway", "database"],
  },
  {
    title: "Competitor Price Drop in EU Market",
    description: "Major processor reduced per-transaction fees by 20% in European markets.",
    affectedTypes: ["payment-processor", "fee-engine"],
  },
  {
    title: "Cryptocurrency Adoption Surge",
    description: "Digital wallet usage up 240% YoY across emerging markets.",
    affectedTypes: ["wallet", "payment-processor", "loyalty"],
  },
  {
    title: "GDPR Fine Guidelines Updated",
    description: "Regulatory body increased maximum penalties for data protection violations.",
    affectedTypes: ["auth-provider", "database", "compliance"],
  },
  {
    title: "AI Fraud Detection Mandate",
    description: "New regulations require ML-based fraud scoring for all real-time payment processing.",
    affectedTypes: ["fraud-detection", "payment-processor"],
  },
]

export async function generateMarketEvent(architecture: string): Promise<MarketEvent | { title: string; description: string; affectedTypes: string[] }> {
  const idx = Math.floor(Math.random() * marketEvents.length)
  return marketEvents[idx]
}
