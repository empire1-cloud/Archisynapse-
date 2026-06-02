"use client"

interface Edge {
  id: string; sourceId: string; targetId: string; status?: string
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
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(0,242,255,0.05)" />
          <stop offset="50%" stopColor="rgba(0,242,255,0.3)" />
          <stop offset="100%" stopColor="rgba(0,242,255,0.05)" />
        </linearGradient>
      </defs>
      {edges.map(edge => {
        const source = nodeMap.get(edge.sourceId)
        const target = nodeMap.get(edge.targetId)
        if (!source || !target) return null
        const sx = source.x + 280, sy = source.y + 60
        const tx = target.x + 280, ty = target.y + 60
        const cx = (sx + tx) / 2, cy = (sy + ty) / 2 - 40
        const isFailed = edge.status === "failed"
        return (
          <g key={edge.id} filter="url(#neural-glow)">
            <path d={`M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`} fill="none"
              stroke={isFailed ? "rgba(239,68,68,0.6)" : "rgba(0,242,255,0.2)"}
              strokeWidth={isFailed ? 2 : 1.5} strokeDasharray={isFailed ? "8,4" : "none"}
              className={isFailed ? "" : "animate-flow-dash"}
              markerEnd={isFailed ? "url(#arrowhead-failed)" : "url(#arrowhead)"} />
          </g>
        )
      })}
    </svg>
  )
}
