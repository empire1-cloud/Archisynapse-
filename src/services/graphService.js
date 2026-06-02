const { v4: uuidv4 } = require('uuid');

const EDGE_TYPES = {
  OFTEN_USED_WITH: 'often-used-with',
  PREREQUISITE_FOR: 'prerequisite-for',
  EXTENDS: 'extends',
  DERIVED_FROM: 'derived-from',
  ANTI_PATTERN_OF: 'anti-pattern-of',
  REQUIRES: 'requires',
  RECOMMENDED_PAIRING: 'recommended-pairing',
  CONFLICTS_WITH: 'conflicts-with',
  SUPERSEDES: 'supersedes',
  ALTERNATIVE_TO: 'alternative-to',
};

const EDGE_TYPE_CONFIG = {
  'often-used-with': { weight: 1.0, symmetric: true },
  'recommended-pairing': { weight: 0.9, symmetric: true },
  extends: { weight: 0.8, symmetric: false },
  'prerequisite-for': { weight: 0.7, symmetric: false },
  requires: { weight: 0.7, symmetric: false },
  'derived-from': { weight: 0.6, symmetric: false },
  'alternative-to': { weight: 0.4, symmetric: true },
  supersedes: { weight: 0.3, symmetric: false },
  'conflicts-with': { weight: -0.5, symmetric: true },
  'anti-pattern-of': { weight: -0.3, symmetric: false },
};

const DISTANCE_DECAY = 0.5;
const MAX_TRAVERSAL_DEPTH = 3;

class GraphEngine {
  constructor() {
    this.nodes = new Map();
    this._outEdges = new Map();
    this._inEdges = new Map();
    this._allEdges = [];
    this._usageCounts = new Map();
  }

  addNode(blueprint) {
    this.nodes.set(blueprint.id, {
      id: blueprint.id,
      slug: blueprint.slug,
      name: blueprint.name,
      category: blueprint.category,
      complexity: blueprint.complexity,
      tags: blueprint.tags || [],
      embedding: blueprint.embedding || null,
    });
  }

  removeNode(id) {
    this.nodes.delete(id);
    const edgesFrom = this._outEdges.get(id) || [];
    const edgesTo = this._inEdges.get(id) || [];
    for (const e of [...edgesFrom, ...edgesTo]) {
      this._removeEdgeInternal(e.id);
    }
    this._outEdges.delete(id);
    this._inEdges.delete(id);
  }

  addEdge({ from, to, type, confidence = 0.8, source = 'manual', metadata = {} }) {
    if (!EDGE_TYPE_CONFIG[type]) throw new Error(`Unknown edge type: ${type}`);
    if (!this.nodes.has(from)) throw new Error(`Node not found: ${from}`);
    if (!this.nodes.has(to)) throw new Error(`Node not found: ${to}`);

    const edge = {
      id: `e_${uuidv4()}`,
      from, to, type, confidence, source, metadata,
      createdAt: new Date().toISOString(),
    };

    this._addEdgeInternal(edge);

    if (EDGE_TYPE_CONFIG[type].symmetric) {
      const reverse = {
        id: `e_${uuidv4()}`,
        from: to, to: from, type, confidence, source, metadata,
        createdAt: edge.createdAt,
      };
      this._addEdgeInternal(reverse);
    }

    return edge;
  }

  _addEdgeInternal(edge) {
    this._allEdges.push(edge);
    if (!this._outEdges.has(edge.from)) this._outEdges.set(edge.from, []);
    if (!this._inEdges.has(edge.to)) this._inEdges.set(edge.to, []);
    this._outEdges.get(edge.from).push(edge);
    this._inEdges.get(edge.to).push(edge);
  }

  _removeEdgeInternal(edgeId) {
    const idx = this._allEdges.findIndex(e => e.id === edgeId);
    if (idx !== -1) this._allEdges.splice(idx, 1);
    for (const map of [this._outEdges, this._inEdges]) {
      for (const [key, edges] of map) {
        const ei = edges.findIndex(e => e.id === edgeId);
        if (ei !== -1) { edges.splice(ei, 1); break; }
      }
    }
  }

  removeEdge(edgeId) {
    const edge = this._allEdges.find(e => e.id === edgeId);
    if (!edge) return false;
    this._removeEdgeInternal(edgeId);
    if (EDGE_TYPE_CONFIG[edge.type]?.symmetric) {
      const rev = this._allEdges.find(e => e.from === edge.to && e.to === edge.from && e.type === edge.type);
      if (rev) this._removeEdgeInternal(rev.id);
    }
    return true;
  }

  getEdgesFrom(id, { type } = {}) {
    const edges = this._outEdges.get(id) || [];
    return type ? edges.filter(e => e.type === type) : edges;
  }

  getEdgesTo(id, { type } = {}) {
    const edges = this._inEdges.get(id) || [];
    return type ? edges.filter(e => e.type === type) : edges;
  }

  getAllEdges({ type } = {}) {
    return type ? this._allEdges.filter(e => e.type === type) : [...this._allEdges];
  }

  getNode(id) {
    return this.nodes.get(id) || null;
  }

  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  traverse(fromId, { maxDepth = MAX_TRAVERSAL_DEPTH, typeFilter } = {}) {
    if (!this.nodes.has(fromId)) return [];

    const visited = new Set();
    const results = [];

    function walk(engine, currentId, path, depth, cumulativeConfidence) {
      if (depth > maxDepth) return;
      if (visited.has(currentId)) return;
      visited.add(currentId);

      if (depth > 0) {
        results.push({
          nodeId: currentId,
          path: [...path, currentId],
          distance: depth,
          confidence: cumulativeConfidence,
        });
      }

      const edges = engine._outEdges.get(currentId) || [];
      for (const edge of edges) {
        if (typeFilter && edge.type !== typeFilter) continue;
        if (visited.has(edge.to)) continue;
        const edgeWeight = EDGE_TYPE_CONFIG[edge.type]?.weight || 1.0;
        const nextConfidence = cumulativeConfidence * edge.confidence * Math.abs(edgeWeight);
        walk(engine, edge.to, [...path, currentId], depth + 1, nextConfidence);
      }
    }

    visited.clear();
    walk(this, fromId, [], 0, 1.0);
    return results;
  }

  getConnectivityScores(seedIds, candidates) {
    if (seedIds.length === 0 || candidates.length === 0) return {};

    const scores = {};
    const seedSet = new Set(seedIds);

    for (const candidateId of candidates) {
      if (seedSet.has(candidateId)) {
        const connectedToOtherSeeds = this.getEdgesFrom(candidateId)
          .filter(e => seedSet.has(e.to) && e.to !== candidateId);
        const connectivityBoost = connectedToOtherSeeds.length > 0
          ? Math.min(connectedToOtherSeeds.reduce((sum, e) => {
              const w = EDGE_TYPE_CONFIG[e.type]?.weight || 0.5;
              return sum + e.confidence * Math.max(0, w);
            }, 0) / connectedToOtherSeeds.length, 1.0)
          : 0.3;
        scores[candidateId] = 0.5 + connectivityBoost * 0.5;
        continue;
      }

      let totalScore = 0;
      let count = 0;

      for (const seedId of seedIds) {
        const traversal = this.traverse(candidateId, { maxDepth: 2 });
        const pathsToSeed = traversal.filter(r =>
          r.path[r.path.length - 1] === seedId ||
          (r.path.length >= 2 && r.path[r.path.length - 2] === seedId && r.nodeId === seedId)
        );

        for (const path of pathsToSeed) {
          if (path.distance <= 2) {
            const decay = Math.pow(DISTANCE_DECAY, path.distance - 1);
            totalScore += path.confidence * decay;
            count++;
          }
        }
      }

      scores[candidateId] = count > 0 ? Math.min(totalScore / count, 1.0) : 0;
    }

    return scores;
  }

  getRelated(id, { limit = 5, minConfidence = 0.3 } = {}) {
    if (!this.nodes.has(id)) return [];
    const edges = this._outEdges.get(id) || [];
    const related = edges
      .filter(e => {
        const w = EDGE_TYPE_CONFIG[e.type]?.weight || 0.5;
        return e.confidence * Math.abs(w) >= minConfidence;
      })
      .map(e => ({
        blueprintId: e.to,
        edgeType: e.type,
        confidence: e.confidence,
        weight: EDGE_TYPE_CONFIG[e.type]?.weight || 0.5,
        score: e.confidence * (EDGE_TYPE_CONFIG[e.type]?.weight || 0.5),
      }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return related;
  }

  getRecommendations(seedIds, { limit = 5, minConfidence = 0.2 } = {}) {
    if (seedIds.length === 0) return [];
    const seen = new Set(seedIds);
    const candidates = [];

    for (const seedId of seedIds) {
      const edges = this._outEdges.get(seedId) || [];
      for (const edge of edges) {
        if (seen.has(edge.to)) continue;
        const w = EDGE_TYPE_CONFIG[edge.type]?.weight || 0.5;
        if (w <= 0) continue;
        const score = edge.confidence * w;
        if (score >= minConfidence) {
          candidates.push({ blueprintId: edge.to, score, source: seedId, edgeType: edge.type });
          seen.add(edge.to);
        }
      }
    }

    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  getBundle(blueprintIds, { name, description } = {}) {
    const nodes = blueprintIds.map(id => this.nodes.get(id)).filter(Boolean);
    const internalEdges = [];
    const edgeSet = new Set();

    for (const id of blueprintIds) {
      const edges = this._outEdges.get(id) || [];
      for (const e of edges) {
        if (blueprintIds.includes(e.to)) {
          const key = [e.from, e.to, e.type].sort().join('::');
          if (!edgeSet.has(key)) {
            internalEdges.push({ from: e.from, to: e.to, type: e.type, confidence: e.confidence });
            edgeSet.add(key);
          }
        }
      }
    }

    const avgConnectivity = internalEdges.length > 0
      ? internalEdges.reduce((sum, e) => sum + e.confidence, 0) / internalEdges.length
      : 0;

    return {
      name: name || `Bundle (${nodes.map(n => n.name).join(', ')})`,
      description: description || 'Auto-generated blueprint bundle',
      blueprints: nodes.map(n => ({ id: n.id, slug: n.slug, name: n.name })),
      internalEdges,
      edgeCount: internalEdges.length,
      avgConnectivity: Math.round(avgConnectivity * 100) / 100,
      createdAt: new Date().toISOString(),
    };
  }

  recordUsage(fromId, toId) {
    const key = [fromId, toId].sort().join('::');
    this._usageCounts.set(key, (this._usageCounts.get(key) || 0) + 1);
  }

  getCoOccurrences(minThreshold = 2) {
    const results = [];
    for (const [key, count] of this._usageCounts) {
      if (count >= minThreshold) {
        const [a, b] = key.split('::');
        results.push({ from: a, to: b, count, source: 'usage' });
      }
    }
    return results.sort((a, b) => b.count - a.count);
  }

  getInfo() {
    const edgeTypeCounts = {};
    for (const e of this._allEdges) {
      edgeTypeCounts[e.type] = (edgeTypeCounts[e.type] || 0) + 1;
    }
    return {
      nodes: this.nodes.size,
      edges: this._allEdges.length,
      edgeTypes: Object.keys(edgeTypeCounts).length,
      edgeTypeBreakdown: edgeTypeCounts,
      usageSignals: this._usageCounts.size,
    };
  }
}

module.exports = { GraphEngine, EDGE_TYPES, EDGE_TYPE_CONFIG };