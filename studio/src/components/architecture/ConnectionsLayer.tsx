"use client"

import { useMemo } from "react"
import { ArchComponent, ArchDependency } from "@/types/architecture"

interface ConnectionsLayerProps {
  components: ArchComponent[]
  dependencies: ArchDependency[]
  isSimulating: boolean
}

export function ConnectionsLayer({ components, dependencies, isSimulating }: ConnectionsLayerProps) {
  const paths = useMemo(() => {
    return dependencies.map(d => {
      const source = components.find(c => c.id === d.sourceId)
      const target = components.find(c => c.id === d.targetId)
      if (!source || !target) return null

      const sx = source.position.x + 120
      const sy = source.position.y + 65
      const tx = target.position.x + 120
      const ty = target.position.y + 65

      const cx1 = sx + (tx - sx) * 0.4
      const cy1 = sy
      const cx2 = sx + (tx - sx) * 0.6
      const cy2 = ty

      const sourceFailed = source.status === "failed"
      const targetFailed = target.status === "failed"

      return {
        id: d.id,
        path: `M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`,
        failed: sourceFailed || targetFailed,
        type: d.type,
      }
    }).filter(Boolean) as { id: string; path: string; failed: boolean; type: string }[]
  }, [components, dependencies])

  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ minWidth: "100%", minHeight: "100%" }}>
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="rgba(0,242,255,0.35)" />
        </marker>
        <marker id="arrow-failed" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="rgba(239,68,68,0.5)" />
        </marker>
      </defs>
      {paths.map(p => (
        <path
          key={p.id}
          d={p.path}
          fill="none"
          stroke={p.failed ? "rgba(239,68,68,0.5)" : `rgba(0,242,255,${isSimulating ? 0.35 : 0.15})`}
          strokeWidth={1.5}
          strokeDasharray={p.failed ? "6,4" : "none"}
          markerEnd={p.failed ? "url(#arrow-failed)" : "url(#arrow)"}
          className={isSimulating && !p.failed ? "animate-flow-dash" : ""}
        />
      ))}
    </svg>
  )
}
