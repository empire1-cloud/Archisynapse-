const { v4: uuidv4 } = require('uuid');
const { EmbeddingEngine, buildEmbeddingText } = require('./embeddingService');
const { GraphEngine, EDGE_TYPES } = require('./graphService');

const engine = new EmbeddingEngine();
const graph = new GraphEngine();
let blueprints = [];

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

function buildBlueprint({
  id = uuidv4(), name, description, tags, inputs = [], outputs = [],
  scoreWeights = {}, exampleUseCases = [], version = '1.0.0',
  components = [], metrics = [], bestPractices = [],
  category = 'creator-economy', complexity = 'medium',
  embedding = null, embeddingModel = null, embeddingVersion = null
} = {}) {
  const now = new Date().toISOString();
  return { id: 'bp_' + id.toString().replace(/^bp_/, ''), slug: toSlug(name), name, description, tags, inputs, outputs, scoreWeights, exampleUseCases, version, components, metrics, bestPractices, category, complexity, embedding, embeddingModel, embeddingVersion, createdAt: now, updatedAt: now };
}

const seedBlueprintData = [
  buildBlueprint({ name: 'Creator Royalty Split', description: 'Blueprint for splitting royalties between creators, collaborators, producers, and rights holders with transparent rules.', tags: ['royalties', 'split', 'creator', 'music', 'collaboration', 'contracts'], inputs: ['creatorId', 'workId', 'participants', 'splitRules'], outputs: ['royaltyGraph', 'payoutSchedule'], scoreWeights: { royalties: 2.0, creator: 1.5, split: 1.5 }, exampleUseCases: ['Indie artist collaborating with a producer and a feature', 'Podcast with multiple recurring hosts and guests'], components: ['Identity service (creators, collaborators)', 'Royalty graph builder', 'Contract template engine', 'Archisynapse payment router'], metrics: ['Time to configure split', 'Dispute rate', 'On-time payout rate', 'Number of collaborators per work'], bestPractices: ['Always store human-readable split summaries alongside machine-readable graphs.', 'Support versioned split agreements for evolving relationships.', 'Expose a clear audit trail for every payout event.'], complexity: 'low' }),
  buildBlueprint({ name: 'AI Music Generation Pipeline', description: 'End-to-end pipeline for AI-assisted music generation, metadata capture, and royalty mapping.', tags: ['ai', 'music', 'generation', 'pipeline', 'metadata', 'creator'], inputs: ['creatorId', 'prompt', 'referenceTracks', 'generationParams'], outputs: ['audioAsset', 'metadata', 'royaltyGraph'], scoreWeights: { ai: 2.0, music: 2.0, generation: 1.5 }, exampleUseCases: ['Producer generating stems from text prompts', 'Creator generating background music for streams'], components: ['Prompt ingestion service', 'Model inference service', 'Metadata extractor', 'Lyrica 3 royalty graph generator', 'Asset storage + CDN'], metrics: ['Generation latency', 'Completion rate', 'Reuse rate of generated assets', 'Attribution completeness score'], bestPractices: ['Capture full prompt + context for provenance and future explainability.', 'Attach royalty graphs at creation time, not retroactively.', 'Log model version and configuration for each generation.'], complexity: 'medium' }),
  buildBlueprint({ name: 'Attribution Graph Pattern', description: 'Pattern for building a graph of influences, samples, and derivations across creative works.', tags: ['attribution', 'graph', 'provenance', 'influence', 'sampling'], inputs: ['workId', 'sourceWorks', 'influenceTypes'], outputs: ['attributionGraph', 'influenceReport'], scoreWeights: { attribution: 2.0, graph: 1.5, provenance: 1.5 }, exampleUseCases: ['Tracking samples across hip-hop tracks', 'Mapping visual inspiration across digital art pieces'], components: ['Graph database / service', 'Work registry', 'Influence classifier', 'Reporting / analytics layer'], metrics: ['Attribution coverage', 'Number of edges per work', 'Dispute resolution time', 'Downstream reuse detection rate'], bestPractices: ['Model attribution as a first-class graph, not as flat metadata.', 'Support multiple influence types (sample, interpolation, inspiration).', 'Expose APIs for third-party verification and audits.'], complexity: 'medium' }),
  buildBlueprint({ name: 'Micro-Royalty Streaming', description: 'Streaming micro-royalties in near real-time based on consumption events (plays, views, uses).', tags: ['micro-royalties', 'streaming', 'real-time', 'events', 'payouts'], inputs: ['usageEvents', 'royaltyGraph', 'settlementConfig'], outputs: ['payoutEvents', 'settlementBatches'], scoreWeights: { 'micro-royalties': 2.0, streaming: 1.5, 'real-time': 1.5 }, exampleUseCases: ['Pay-per-play streaming platform', 'Live tipping and micro-support for creators'], components: ['Event ingestion pipeline', 'Usage-to-royalty mapper', 'Balance ledger', 'Archisynapse settlement router'], metrics: ['End-to-end settlement latency', 'Minimum payout size', 'Failed payout rate', 'Creator earnings volatility'], bestPractices: ['Batch small events while preserving per-event traceability.', 'Expose creator-facing dashboards for real-time earnings.', 'Design for idempotent event processing to avoid double-payouts.'], complexity: 'high' }),
  buildBlueprint({ name: 'Compliance-Aware Routing', description: 'Routing payments and flows with awareness of jurisdiction, KYC/AML, and regulatory constraints.', tags: ['compliance', 'routing', 'kyc', 'aml', 'jurisdiction', 'payments'], inputs: ['creatorProfile', 'counterpartyProfile', 'jurisdictionData', 'transactionIntent'], outputs: ['routingPlan', 'complianceChecks', 'blockedEvents'], scoreWeights: { compliance: 2.0, routing: 1.5, kyc: 1.5 }, exampleUseCases: ['Global payout platform for creators', 'Marketplaces operating across multiple regulatory zones'], components: ['Compliance rules engine', 'Jurisdiction resolver', 'KYC/AML provider integrations', 'Archisynapse routing engine'], metrics: ['Compliance check latency', 'False positive rate', 'Regulatory incident count', 'Jurisdiction coverage'], bestPractices: ['Keep compliance rules declarative and versioned.', 'Log every decision with machine- and human-readable explanations.', 'Design for pluggable providers and evolving regulations.'], complexity: 'high' }),
  buildBlueprint({ name: 'Multi-Agent Workflow', description: 'Coordinating multiple AI and human agents across a creative workflow with clear roles and handoffs.', tags: ['multi-agent', 'workflow', 'orchestration', 'ai', 'human-in-the-loop'], inputs: ['workflowDefinition', 'agents', 'tasks', 'constraints'], outputs: ['workflowRuns', 'agentLogs', 'artifacts'], scoreWeights: { 'multi-agent': 2.0, workflow: 1.5, orchestration: 1.5 }, exampleUseCases: ['AI-assisted music production with human review stages', 'Content pipeline with drafting, editing, and compliance checks'], components: ['Workflow engine', 'Agent registry', 'Task queue', 'Notification / handoff system'], metrics: ['Workflow completion time', 'Number of handoffs per workflow', 'Agent utilization', 'Error / rollback rate'], bestPractices: ['Make agent responsibilities explicit and observable.', 'Design for retries and fallbacks at each step.', 'Capture full lineage of artifacts across agents.'], complexity: 'high' }),
  buildBlueprint({ name: 'Creator Subscription Model', description: 'Recurring subscription model for creators with tiers, perks, and gated content.', tags: ['subscription', 'creator', 'membership', 'tiers', 'recurring'], inputs: ['creatorId', 'plans', 'pricing', 'benefits'], outputs: ['subscriptionPlans', 'entitlementGraph', 'billingEvents'], scoreWeights: { subscription: 2.0, membership: 1.5, creator: 1.5 }, exampleUseCases: ['Membership tiers for a music artist', 'Premium content subscriptions for a podcaster'], components: ['Plan / pricing service', 'Billing engine', 'Entitlement / access control', 'Archisynapse payout routing'], metrics: ['MRR', 'Churn rate', 'ARPU', 'Benefit utilization rate'], bestPractices: ['Keep plan changes backward-compatible where possible.', 'Expose clear upgrade/downgrade paths for subscribers.', 'Tie entitlements directly to plan definitions, not ad-hoc flags.'], complexity: 'medium' }),
  buildBlueprint({ name: 'Digital Asset Provenance', description: 'Tracking origin, ownership, and transformation history of digital assets across platforms.', tags: ['provenance', 'digital-asset', 'ownership', 'history', 'chain-of-custody'], inputs: ['assetId', 'creatorId', 'events'], outputs: ['provenanceRecord', 'auditTrail'], scoreWeights: { provenance: 2.0, 'digital-asset': 1.5, ownership: 1.5 }, exampleUseCases: ['NFT-like provenance without requiring a blockchain', 'Cross-platform asset reuse tracking'], components: ['Asset registry', 'Event log / journal', 'Signature / verification service', 'Public / semi-public provenance API'], metrics: ['Provenance completeness', 'Verification latency', 'Disputed ownership rate'], bestPractices: ['Use append-only logs for provenance events.', 'Support cryptographic proofs where appropriate.', 'Design for interoperability with external registries.'], complexity: 'medium' }),
  buildBlueprint({ name: 'Marketplace Escrow Pattern', description: 'Escrow-based pattern for marketplaces where funds are held until conditions are met.', tags: ['escrow', 'marketplace', 'trust', 'dispute', 'settlement'], inputs: ['buyerId', 'sellerId', 'orderId', 'escrowRules'], outputs: ['escrowAccount', 'releaseEvents', 'refundEvents'], scoreWeights: { escrow: 2.0, marketplace: 1.5, settlement: 1.5 }, exampleUseCases: ['Commission-based art marketplaces', 'Custom music / beat marketplaces'], components: ['Order management', 'Escrow ledger', 'Dispute resolution workflow', 'Archisynapse payout routing'], metrics: ['Dispute rate', 'Time in escrow', 'Refund rate', 'Successful completion rate'], bestPractices: ['Make escrow rules explicit and visible to all parties.', 'Automate releases where possible, but support manual overrides.', 'Keep a clear separation between escrow funds and operational funds.'], complexity: 'medium' }),
  buildBlueprint({ name: 'Event-Driven Settlement', description: 'Settling balances and payouts based on domain events rather than fixed schedules.', tags: ['event-driven', 'settlement', 'streaming', 'ledger', 'real-time'], inputs: ['domainEvents', 'settlementRules', 'ledgerState'], outputs: ['settlementEvents', 'payoutInstructions'], scoreWeights: { 'event-driven': 2.0, settlement: 2.0, ledger: 1.5 }, exampleUseCases: ['Instant settlement after a live show or stream', 'Usage-based billing with near real-time payouts'], components: ['Event bus', 'Settlement rules engine', 'Ledger service', 'Archisynapse payout executor'], metrics: ['Settlement latency', 'Reconciliation error rate', 'Event processing throughput'], bestPractices: ['Design events to be immutable and idempotent.', 'Separate event ingestion from settlement execution.', 'Continuously reconcile ledger state against external systems.'], complexity: 'high' })
];

const seedEdges = [
  { from: 'creator-royalty-split', to: 'micro-royalty-streaming', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.85, source: 'manual' },
  { from: 'creator-royalty-split', to: 'compliance-aware-routing', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.70, source: 'manual' },
  { from: 'ai-music-generation-pipeline', to: 'digital-asset-provenance', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.80, source: 'manual' },
  { from: 'ai-music-generation-pipeline', to: 'attribution-graph-pattern', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.75, source: 'manual' },
  { from: 'micro-royalty-streaming', to: 'event-driven-settlement', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.90, source: 'manual' },
  { from: 'micro-royalty-streaming', to: 'compliance-aware-routing', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.65, source: 'manual' },
  { from: 'micro-royalty-streaming', to: 'creator-subscription-model', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.60, source: 'manual' },
  { from: 'event-driven-settlement', to: 'marketplace-escrow-pattern', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.70, source: 'manual' },
  { from: 'compliance-aware-routing', to: 'marketplace-escrow-pattern', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.75, source: 'manual' },
  { from: 'digital-asset-provenance', to: 'attribution-graph-pattern', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.85, source: 'manual' },
  { from: 'creator-subscription-model', to: 'creator-royalty-split', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.75, source: 'manual' },
  { from: 'multi-agent-workflow', to: 'ai-music-generation-pipeline', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.65, source: 'manual' },
  { from: 'creator-royalty-split', to: 'micro-royalty-streaming', type: EDGE_TYPES.PREREQUISITE_FOR, confidence: 0.80, source: 'manual' },
  { from: 'attribution-graph-pattern', to: 'digital-asset-provenance', type: EDGE_TYPES.REQUIRES, confidence: 0.70, source: 'manual' },
  { from: 'event-driven-settlement', to: 'micro-royalty-streaming', type: EDGE_TYPES.ALTERNATIVE_TO, confidence: 0.50, source: 'manual' },
  { from: 'creator-subscription-model', to: 'creator-royalty-split', type: EDGE_TYPES.REQUIRES, confidence: 0.60, source: 'manual' },
  { from: 'micro-royalty-streaming', to: 'event-driven-settlement', type: EDGE_TYPES.EXTENDS, confidence: 0.70, source: 'manual' },
  { from: 'ai-music-generation-pipeline', to: 'multi-agent-workflow', type: EDGE_TYPES.EXTENDS, confidence: 0.60, source: 'manual' },
  { from: 'marketplace-escrow-pattern', to: 'compliance-aware-routing', type: EDGE_TYPES.EXTENDS, confidence: 0.65, source: 'manual' },
  { from: 'creator-subscription-model', to: 'creator-royalty-split', type: EDGE_TYPES.RECOMMENDED_PAIRING, confidence: 0.80, source: 'manual' },
  { from: 'micro-royalty-streaming', to: 'ai-music-generation-pipeline', type: EDGE_TYPES.RECOMMENDED_PAIRING, confidence: 0.70, source: 'manual' },
  { from: 'attribution-graph-pattern', to: 'creator-royalty-split', type: EDGE_TYPES.ALTERNATIVE_TO, confidence: 0.30, source: 'manual' },
];

function findBpBySlug(slug) {
  return blueprints.find(b => b.slug === slug);
}

function embedBlueprint(bp) {
  const text = buildEmbeddingText(bp);
  return {
    embedding: engine.generateEmbedding(text),
    embeddingModel: engine.modelName,
    embeddingVersion: engine.embeddingVersion
  };
}

function syncGraphNode(bp) {
  graph.addNode(bp);
}

function seedBlueprints() {
  if (blueprints.length > 0) return blueprints;
  blueprints = seedBlueprintData;
  engine.buildIndex(blueprints);
  for (const bp of blueprints) {
    Object.assign(bp, embedBlueprint(bp));
    syncGraphNode(bp);
  }
  for (const edgeData of seedEdges) {
    const fromBp = findBpBySlug(edgeData.from);
    const toBp = findBpBySlug(edgeData.to);
    if (fromBp && toBp) {
      graph.addEdge({ ...edgeData, from: fromBp.id, to: toBp.id });
    }
  }
  return blueprints;
}

function getAllBlueprints() {
  return blueprints;
}

function getBlueprintById(id) {
  return blueprints.find(b => b.id === id) || null;
}

function createBlueprint(data) {
  const bp = buildBlueprint(data);
  Object.assign(bp, embedBlueprint(bp));
  blueprints.push(bp);
  engine.upsert(bp);
  syncGraphNode(bp);
  return bp;
}

function updateBlueprint(id, updates) {
  const idx = blueprints.findIndex(b => b.id === id);
  if (idx === -1) return null;
  const existing = blueprints[idx];
  const now = new Date().toISOString();
  const name = updates.name || existing.name;
  const slug = updates.slug || existing.slug || toSlug(name);
  const updated = { ...existing, ...updates, name, slug, updatedAt: now };
  Object.assign(updated, embedBlueprint(updated));
  blueprints[idx] = updated;
  engine.upsert(updated);
  syncGraphNode(updated);
  return updated;
}

function deleteBlueprint(id) {
  const idx = blueprints.findIndex(b => b.id === id);
  if (idx === -1) return false;
  blueprints.splice(idx, 1);
  engine.remove(id);
  graph.removeNode(id);
  return true;
}

function listBlueprints({ limit = 20, offset = 0, category, tags = [], complexity } = {}) {
  let results = [...blueprints];
  if (category) results = results.filter(b => b.category === category);
  if (complexity) results = results.filter(b => b.complexity === complexity);
  if (tags && tags.length > 0) {
    const normalized = tags.map(t => t.toLowerCase());
    results = results.filter(b => (b.tags || []).map(t => t.toLowerCase()).some(t => normalized.includes(t)));
  }
  return { items: results.slice(offset, offset + limit), total: results.length, limit: parseInt(limit), offset: parseInt(offset) };
}

function getBlueprint(id) {
  return getBlueprintById(id);
}

function getBlueprintBySlug(slug) {
  return blueprints.find(b => b.slug === slug) || null;
}

function tagScore(bp, tags) {
  if (!tags || tags.length === 0) return 0;
  let score = 0;
  const bpTags = (bp.tags || []).map(t => t.toLowerCase());
  for (const tag of tags.map(t => t.toLowerCase())) {
    if (bpTags.includes(tag)) {
      score += bp.scoreWeights?.[tag] || 1.0;
    }
  }
  return score;
}

function textMatchScore(bp, query) {
  if (!query) return 0;
  const q = query.toLowerCase();
  const haystack = (bp.name || '').toLowerCase() + ' ' + (bp.description || '').toLowerCase() + ' ' + (bp.exampleUseCases || []).join(' ').toLowerCase();
  return haystack.includes(q) ? 1.0 : 0;
}

function matchBlueprints({ query = '', category, tags = [], complexity, limit = 5 } = {}) {
  let candidates = [...blueprints];
  if (category) candidates = candidates.filter(b => b.category === category);
  if (complexity) candidates = candidates.filter(b => b.complexity === complexity);

  const queryText = query || (tags || []).join(' ');
  const semanticResults = queryText ? engine.search(queryText, blueprints.length) : [];

  const semanticMap = {};
  for (const sr of semanticResults) {
    semanticMap[sr.id] = sr.score;
  }

  const scored = candidates.map(bp => {
    const embSim = semanticMap[bp.id] || 0;
    const tagS = tags.length > 0 ? tagScore(bp, tags) : 0;
    const txtS = query ? textMatchScore(bp, query) : 0;
    const hasAnySignal = tags.length > 0 || query;
    const score = hasAnySignal
      ? (0.6 * embSim + 0.3 * tagS + 0.1 * txtS)
      : (tagS + txtS);
    return { blueprint: bp, score, embeddingSimilarity: embSim, tagScore: tagS, textScore: txtS };
  });

  const filtered = scored.filter(s => s.score > 0);
  if (filtered.length === 0 && query) {
    return scored.sort((a, b) => b.embeddingSimilarity - a.embeddingSimilarity).slice(0, limit).map(s => s.blueprint);
  }
  return filtered.sort((a, b) => b.score - a.score).slice(0, limit).map(s => s.blueprint);
}

function semanticMatchBlueprints({ query, tags = [], category, complexity, limit = 5 } = {}) {
  let candidates = [...blueprints];
  if (category) candidates = candidates.filter(b => b.category === category);
  if (complexity) candidates = candidates.filter(b => b.complexity === complexity);

  const queryText = query || (tags || []).join(' ');
  const semanticResults = engine.search(queryText || 'architecture pattern', candidates.length);

  const bpMap = {};
  for (const bp of candidates) bpMap[bp.id] = bp;

  const tagSet = new Set(tags.map(t => t.toLowerCase()));
  const topSeedIds = semanticResults.slice(0, 3).map(r => r.id);
  const candidateIds = candidates.map(b => b.id);
  const connectivityScores = graph.getConnectivityScores(topSeedIds, candidateIds);

  const scored = semanticResults
    .filter(r => bpMap[r.id])
    .map(r => {
      const bp = bpMap[r.id];
      const tagS = tagSet.size > 0 ? tagScore(bp, [...tagSet]) : 0;
      const txtS = query ? textMatchScore(bp, query) : 0;
      const graphS = connectivityScores[r.id] || 0;
      const score = 0.5 * r.score + 0.2 * tagS + 0.2 * graphS + 0.1 * txtS;
      return { blueprint: bp, score, embeddingSimilarity: r.score, tagScore: tagS, graphScore: graphS, textScore: txtS };
    });

  if (scored.length === 0) {
    const fallback = matchBlueprints({ query, tags, category, complexity, limit });
    return fallback.map(bp => ({ blueprint: bp, score: 0, embeddingSimilarity: 0, tagScore: 0, graphScore: 0, textScore: 0 }));
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

function getEmbeddingInfo() {
  return engine.getInfo();
}

function getGraph() {
  return graph;
}

function getGraphInfo() {
  return graph.getInfo();
}

function getGraphNode(id) {
  const bp = getBlueprintById(id);
  if (!bp) return null;
  return {
    blueprint: bp,
    node: graph.getNode(id),
    edges: graph.getEdgesFrom(id),
    incomingEdges: graph.getEdgesTo(id),
  };
}

function getGraphEdges(id) {
  if (!getBlueprintById(id)) return null;
  return { from: graph.getEdgesFrom(id), to: graph.getEdgesTo(id) };
}

function getGraphRelated(id, { limit = 5, minConfidence = 0.3 } = {}) {
  const related = graph.getRelated(id, { limit, minConfidence });
  return related.map(r => ({
    ...r,
    blueprint: getBlueprintById(r.blueprintId),
  })).filter(r => r.blueprint);
}

function getGraphRecommendations(seedIds, { limit = 5, minConfidence = 0.2 } = {}) {
  const recommendations = graph.getRecommendations(seedIds, { limit, minConfidence });
  return recommendations.map(r => ({
    ...r,
    blueprint: getBlueprintById(r.blueprintId),
    sourceBlueprint: getBlueprintById(r.source),
  })).filter(r => r.blueprint && r.sourceBlueprint);
}

function getGraphBundle(blueprintIds, { name, description } = {}) {
  const bundle = graph.getBundle(blueprintIds, { name, description });
  bundle.blueprints = bundle.blueprints.map(b => ({
    ...b,
    blueprint: getBlueprintById(b.id),
  }));
  return bundle;
}

function addGraphEdge({ fromId, toId, type, confidence = 0.8, source = 'manual', metadata = {} }) {
  const fromBp = getBlueprintById(fromId);
  const toBp = getBlueprintById(toId);
  if (!fromBp || !toBp) return null;
  return graph.addEdge({ from: fromId, to: toId, type, confidence, source, metadata });
}

function removeGraphEdge(edgeId) {
  return graph.removeEdge(edgeId);
}

module.exports = {
  seedBlueprints, getAllBlueprints, getBlueprintById, getBlueprintBySlug,
  createBlueprint, updateBlueprint, deleteBlueprint,
  listBlueprints, getBlueprint, matchBlueprints, semanticMatchBlueprints,
  getEmbeddingInfo, getGraph, getGraphInfo, getGraphNode, getGraphEdges,
  getGraphRelated, getGraphRecommendations, getGraphBundle,
  addGraphEdge, removeGraphEdge,
};