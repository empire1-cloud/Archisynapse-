"use client"

import { useState } from "react"
import { Layout } from "@/components/Layout"
import { SynapseInsights } from "@/components/SynapseInsights"
import { SemanticPlayground } from "@/components/SemanticPlayground"
import { GraphExplorer } from "@/components/GraphExplorer"
import { BusinessROIInspector } from "@/components/BusinessROIInspector"

export default function StudioPage() {
  const [activeTab, setActiveTab] = useState("insights")

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "insights" && <SynapseInsights />}
      {activeTab === "playground" && <SemanticPlayground />}
      {activeTab === "graph" && <GraphExplorer />}
      {activeTab === "roi" && <BusinessROIInspector />}
    </Layout>
  )
}
