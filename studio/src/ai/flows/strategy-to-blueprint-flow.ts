import { ArchComponent, ArchDependency, ComponentType } from "@/types/architecture"

export interface StrategyResult {
  name: string
  components: Omit<ArchComponent, "config" | "status" | "latency" | "throughput" | "techDebtScore">[]
  dependencies: Omit<ArchDependency, "id">[]
}

export async function generateStrategyBlueprint(input: { goal: string }): Promise<StrategyResult> {
  const goal = input.goal.toLowerCase()

  if (goal.includes("fintech") || goal.includes("neobank") || goal.includes("payment")) {
    return {
      name: "Fintech Payment Platform",
      components: [
        { id: "c-1", name: "Mobile App", type: "user-interface" as ComponentType, description: "Customer mobile banking app", position: { x: 250, y: 150 }, roiScore: 80, riskScore: 20 },
        { id: "c-2", name: "API Gateway", type: "gateway" as ComponentType, description: "Global entry with auth", position: { x: 550, y: 150 }, roiScore: 60, riskScore: 10 },
        { id: "c-3", name: "Payment Processor", type: "payment-processor" as ComponentType, description: "PCI-compliant processing", position: { x: 850, y: 150 }, roiScore: 95, riskScore: 40 },
        { id: "c-4", name: "Auth Service", type: "auth-provider" as ComponentType, description: "KYC/AML identity", position: { x: 250, y: 400 }, roiScore: 70, riskScore: 15 },
        { id: "c-5", name: "Fraud Detection", type: "fraud-detection" as ComponentType, description: "ML-based fraud scoring", position: { x: 550, y: 400 }, roiScore: 85, riskScore: 25 },
        { id: "c-6", name: "Immutable Ledger", type: "ledger" as ComponentType, description: "Audit trail", position: { x: 850, y: 400 }, roiScore: 50, riskScore: 5 },
      ],
      dependencies: [
        { sourceId: "c-1", targetId: "c-2", type: "sync" },
        { sourceId: "c-2", targetId: "c-3", type: "sync" },
        { sourceId: "c-4", targetId: "c-2", type: "sync" },
        { sourceId: "c-5", targetId: "c-3", type: "async" },
        { sourceId: "c-3", targetId: "c-6", type: "event" },
      ],
    }
  }

  if (goal.includes("marketplace") || goal.includes("ecommerce") || goal.includes("shop")) {
    return {
      name: "Multi-Tenant Marketplace",
      components: [
        { id: "c-1", name: "Storefront", type: "user-interface" as ComponentType, description: "Customer-facing store", position: { x: 250, y: 150 }, roiScore: 75, riskScore: 15 },
        { id: "c-2", name: "Marketplace API", type: "marketplace" as ComponentType, description: "Multi-vendor engine", position: { x: 550, y: 150 }, roiScore: 90, riskScore: 30 },
        { id: "c-3", name: "Payment Rail", type: "payment-processor" as ComponentType, description: "Split payments", position: { x: 850, y: 150 }, roiScore: 88, riskScore: 35 },
        { id: "c-4", name: "Fee Engine", type: "fee-engine" as ComponentType, description: "Commission calc", position: { x: 550, y: 400 }, roiScore: 70, riskScore: 10 },
      ],
      dependencies: [
        { sourceId: "c-1", targetId: "c-2", type: "sync" },
        { sourceId: "c-2", targetId: "c-3", type: "sync" },
        { sourceId: "c-2", targetId: "c-4", type: "async" },
      ],
    }
  }

  return {
    name: "Strategic Platform",
    components: [
      { id: "c-1", name: "Web App", type: "user-interface" as ComponentType, description: "User interface", position: { x: 300, y: 200 }, roiScore: 65, riskScore: 15 },
      { id: "c-2", name: "API Gateway", type: "gateway" as ComponentType, description: "Security layer", position: { x: 600, y: 200 }, roiScore: 55, riskScore: 10 },
      { id: "c-3", name: "Core Service", type: "compute" as ComponentType, description: "Business logic", position: { x: 450, y: 400 }, roiScore: 70, riskScore: 25 },
    ],
    dependencies: [
      { sourceId: "c-1", targetId: "c-2", type: "sync" },
      { sourceId: "c-2", targetId: "c-3", type: "sync" },
    ],
  }
}
