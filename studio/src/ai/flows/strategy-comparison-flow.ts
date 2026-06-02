export interface ComparisonOutput {
  winner: string
  roiDelta: string
  riskDelta: string
  reasoning: string
}

export async function compareStrategies(input: {
  baseline: { name: string; components: { name: string; type: string; roiScore?: number; riskScore?: number }[] }
  alternative: { name: string; components: { name: string; type: string; roiScore?: number; riskScore?: number }[] }
}): Promise<ComparisonOutput> {
  const baseROI = input.baseline.components.reduce((a, c) => a + (c.roiScore || 50), 0) / input.baseline.components.length
  const altROI = input.alternative.components.reduce((a, c) => a + (c.roiScore || 50), 0) / input.alternative.components.length
  const baseRisk = input.baseline.components.reduce((a, c) => a + (c.riskScore || 20), 0) / input.baseline.components.length
  const altRisk = input.alternative.components.reduce((a, c) => a + (c.riskScore || 20), 0) / input.alternative.components.length

  const winner = altROI - altRisk > baseROI - baseRisk ? input.alternative.name : input.baseline.name

  return {
    winner,
    roiDelta: `${(altROI - baseROI).toFixed(1)}%`,
    riskDelta: `${(altRisk - baseRisk).toFixed(1)}%`,
    reasoning: `${winner} achieves superior risk-adjusted return with ${input.alternative.components.length} components vs ${input.baseline.components.length}.`,
  }
}
