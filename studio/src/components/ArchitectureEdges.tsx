"use client"

interface Edge {
  id: string
  sourceId: string
  targetId: string
  latency?: number
  throughput?: number
  revenueContribution?: number
  status?: string
}

interface ArchitectureEdgesProps {
  edges: Edge[]
  nodes: Array<{ id: string; position: { x: number; y: number } }>
}

export function ArchitectureEdges({ edges, nodes }: ArchitectureEdgesProps) {
  const nodeMap = new Map(nodes.map(n => [n.id, n.position]))

  return (
    <svg className="absolute inset-0 pointer-events-none w-full h-full" style={{ minWidth: "100%", minHeight: "100%" }}>
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="rgba(0,242,255,0.4)" />
        </marker>
        <marker id="arrowhead-failed" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="rgba(239,68,68,0.6)" />
        </marker>
        <filter id="neural-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(0,242,255,0.1)" />
          <stop offset="50%" stopColor="rgba(0,242,255,0.4)" />
          <stop offset="100%" stopColor="rgba(0,242,255,0.1)" />
        </linearGradient>
      </defs>

      {edges.map(edge => {
        const source = nodeMap.get(edge.sourceId)
        const target = nodeMap.get(edge.targetId)
        if (!source || !target) return null

        const sx = source.x + 400
        const sy = source.y + 120
        const tx = target.x + 400
        const ty = target.y + 120
        const isFailed = edge.status === "failed"

        const cx = (sx + tx) / 2
        const cy = (sy + ty) / 2 - 60
        const d = `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`

        return (
          <g key={edge.id} filter="url(#neural-glow)">
            <path
              d={d}
              fill="none"
              stroke={isFailed ? "rgba(239,68,68,0.6)" : "rgba(0,242,255,0.25)"}
              strokeWidth={isFailed ? 2 : 1.5}
              strokeDasharray={isFailed ? "8,4" : "none"}
              className={isFailed ? "" : "animate-flow-dash"}
              markerEnd={isFailed ? "url(#arrowhead-failed)" : "url(#arrowhead)"}
            />
            <path
              d={d}
              fill="none"
              stroke={isFailed ? "rgba(239,68,68,0.2)" : "url(#flowGradient)"}
              strokeWidth={isFailed ? 3 : 4}
              opacity={0.3}
            />
          </g>
        )
      })}
    </svg>
  )
}
