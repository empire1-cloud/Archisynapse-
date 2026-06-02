const GEMINI_MODEL = "gemini-2.0-flash-exp"

async function callGemini(prompt: string): Promise<string> {
  const key = typeof window !== "undefined"
    ? (window as any).__NEXT_PUBLIC_GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
    : process.env.NEXT_PUBLIC_GEMINI_API_KEY

  if (!key) throw new Error("Gemini API key not configured")

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error (${res.status}): ${err}`)
  }
  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
}

export interface DesignSuggestion {
  componentType: string
  reason: string
  businessImpact: string
  revenueDelta: number
}

export async function analyzeArchitecture(components: { name: string; type: string; roiScore?: number }[]): Promise<DesignSuggestion[]> {
  const summary = components.map(c => `${c.name} (${c.type}, ROI:${c.roiScore || 50})`).join(", ")
  const prompt = `You are an expert fintech architect analyzing a payment platform.

Current architecture: ${summary}

Suggest 2-3 architectural improvements that unlock specific business value.
For each, provide:
- componentType: the type of component to add
- reason: why it helps (technical)
- businessImpact: how it drives revenue or reduces risk (business)
- revenueDelta: estimated % revenue impact (0-40)

Return JSON only: [{componentType, reason, businessImpact, revenueDelta}]`

  try {
    const text = await callGemini(prompt)
    const clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
    return JSON.parse(clean)
  } catch {
    return [
      { componentType: "cache", reason: "Reduce database latency", businessImpact: "Enable premium low-latency tier", revenueDelta: 15 },
      { componentType: "fraud-detection", reason: "Block fraudulent transactions", businessImpact: "Reduce chargebacks by 40%", revenueDelta: 12 },
    ]
  }
}
