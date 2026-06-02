const transactionService = require('../services/transactionService');
const customerService = require('../services/customerService');
const payoutService = require('../services/payoutService');
const blueprintService = require('../services/blueprintService');

describe('Transaction Service', () => {
  it('should create a transaction', async () => {
    const txn = await transactionService.createTransaction({
      amount: 1000,
      currency: 'USD',
      payment_method: { type: 'card' }
    });
    expect(txn.id).toMatch(/^txn_/);
    expect(txn.status).toBe('succeeded');
    expect(txn.amount).toBe(1000);
  });

  it('should get a transaction by id', async () => {
    const txn = await transactionService.createTransaction({
      amount: 500,
      currency: 'EUR',
      payment_method: { type: 'card' }
    });
    const found = await transactionService.getTransaction(txn.id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(txn.id);
  });

  it('should return null for non-existent transaction', async () => {
    const found = await transactionService.getTransaction('nonexistent');
    expect(found).toBeNull();
  });

  it('should list transactions with pagination', async () => {
    const result = await transactionService.listTransactions({ limit: 10, offset: 0 });
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('offset');
    expect(parseInt(result.limit)).toBe(10);
  });

  it('should refund a transaction', async () => {
    const txn = await transactionService.createTransaction({
      amount: 2000,
      currency: 'USD',
      payment_method: { type: 'card' }
    });
    const refund = await transactionService.refundTransaction({
      transactionId: txn.id
    });
    expect(refund).toHaveProperty('id');
    expect(refund.amount).toBe(2000);
    expect(refund.status).toBe('succeeded');
  });

  it('should reject refund of non-existent transaction', async () => {
    await expect(
      transactionService.refundTransaction({ transactionId: 'nonexistent' })
    ).rejects.toThrow('Transaction not found');
  });
});

describe('Customer Service', () => {
  it('should create a customer', async () => {
    const customer = await customerService.createCustomer({
      email: 'test@example.com',
      name: 'John Doe'
    });
    expect(customer.id).toMatch(/^cus_/);
    expect(customer.email).toBe('test@example.com');
    expect(customer.name).toBe('John Doe');
  });

  it('should get a customer by id', async () => {
    const c = await customerService.createCustomer({
      email: 'jane@example.com',
      name: 'Jane Doe'
    });
    const found = await customerService.getCustomer(c.id);
    expect(found).not.toBeNull();
    expect(found.email).toBe('jane@example.com');
  });

  it('should return null for non-existent customer', async () => {
    const found = await customerService.getCustomer('nonexistent');
    expect(found).toBeNull();
  });

  it('should list customers with pagination', async () => {
    const result = await customerService.listCustomers({ limit: 10, offset: 0 });
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(parseInt(result.limit)).toBe(10);
  });
});

describe('Payout Service', () => {
  it('should list payouts with default params', async () => {
    const result = await payoutService.listPayouts();
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(result.total).toBeGreaterThan(0);
  });

  it('should filter payouts by status', async () => {
    const result = await payoutService.listPayouts({ status: 'completed' });
    result.data.forEach(p => {
      expect(p.status).toBe('completed');
    });
  });
});

describe('Blueprint Service', () => {
  beforeEach(() => {
    blueprintService.seedBlueprints();
  });

  it('should seed 10 blueprints', () => {
    const all = blueprintService.getAllBlueprints();
    expect(all.length).toBe(10);
  });

  it('should get a blueprint by id', () => {
    const all = blueprintService.getAllBlueprints();
    const first = all[0];
    const found = blueprintService.getBlueprintById(first.id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(first.id);
  });

  it('should get a blueprint by slug', () => {
    const found = blueprintService.getBlueprintBySlug('creator-royalty-split');
    expect(found).not.toBeNull();
    expect(found.name).toBe('Creator Royalty Split');
  });

  it('should return null for non-existent id', () => {
    const found = blueprintService.getBlueprintById('nonexistent');
    expect(found).toBeNull();
  });

  it('should list blueprints with pagination', () => {
    const result = blueprintService.listBlueprints({ limit: 3, offset: 0 });
    expect(result.items.length).toBe(3);
    expect(result.total).toBe(10);
  });

  it('should filter blueprints by category', () => {
    const result = blueprintService.listBlueprints({ category: 'creator-economy' });
    expect(result.items.length).toBeGreaterThan(0);
    result.items.forEach(b => expect(b.category).toBe('creator-economy'));
  });

  it('should filter blueprints by complexity', () => {
    const result = blueprintService.listBlueprints({ complexity: 'low' });
    expect(result.items.length).toBe(1);
    expect(result.items[0].name).toBe('Creator Royalty Split');
  });

  it('should match blueprints by tag', () => {
    const result = blueprintService.matchBlueprints({ tags: ['royalties'] });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe('Creator Royalty Split');
  });

  it('should match blueprints by query text', () => {
    const result = blueprintService.matchBlueprints({ query: 'royalty' });
    expect(result.length).toBeGreaterThan(0);
  });

  it('should create a new blueprint', () => {
    const bp = blueprintService.createBlueprint({
      name: 'Test Pattern',
      description: 'A test blueprint',
      tags: ['test']
    });
    expect(bp.id).toBeDefined();
    expect(bp.slug).toBe('test-pattern');
    expect(bp.name).toBe('Test Pattern');
  });

  it('should update an existing blueprint', () => {
    const all = blueprintService.getAllBlueprints();
    const first = all[0];
    const updated = blueprintService.updateBlueprint(first.id, { description: 'Updated description' });
    expect(updated.description).toBe('Updated description');
  });

  it('should delete a blueprint', () => {
    const bp = blueprintService.createBlueprint({ name: 'Delete Me', tags: ['test'] });
    const ok = blueprintService.deleteBlueprint(bp.id);
    expect(ok).toBe(true);
    const found = blueprintService.getBlueprintById(bp.id);
    expect(found).toBeNull();
  });

  it('should return null when updating non-existent blueprint', () => {
    const result = blueprintService.updateBlueprint('nonexistent', { name: 'Nope' });
    expect(result).toBeNull();
  });

  it('should return false when deleting non-existent blueprint', () => {
    const result = blueprintService.deleteBlueprint('nonexistent');
    expect(result).toBe(false);
  });

  it('should generate embeddings for all seeded blueprints', () => {
    const all = blueprintService.getAllBlueprints();
    all.forEach(bp => {
      expect(bp.embedding).toBeDefined();
      expect(Array.isArray(bp.embedding)).toBe(true);
      expect(bp.embedding.length).toBeGreaterThan(0);
      expect(bp.embeddingModel).toBe('soulfire-embed-v1');
      expect(bp.embeddingVersion).toBe('2026-06-01');
    });
  });

  it('should auto-embed on create', () => {
    const bp = blueprintService.createBlueprint({ name: 'Embed Test', tags: ['test'] });
    expect(bp.embedding).toBeDefined();
    expect(bp.embedding.length).toBeGreaterThan(0);
  });

  it('should auto-embed on update', () => {
    const all = blueprintService.getAllBlueprints();
    const bp = all[0];
    const updated = blueprintService.updateBlueprint(bp.id, { description: 'Updated description for embedding test' });
    expect(updated.embedding).toBeDefined();
  });

  it('should return embedding engine info', () => {
    const info = blueprintService.getEmbeddingInfo();
    expect(info.model).toBe('soulfire-embed-v1');
    expect(info.indexed).toBeGreaterThan(0);
    expect(info.dimensions).toBeGreaterThan(0);
    expect(info.vocabularyTerms).toBeGreaterThan(0);
  });

  it('should semantic match by query', () => {
    const results = blueprintService.semanticMatchBlueprints({
      query: 'royalty music creator split',
      limit: 3
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].embeddingSimilarity).toBeGreaterThan(0);
    expect(results[0].blueprint).toBeDefined();
  });

  it('should semantic match with tags and scores', () => {
    const results = blueprintService.semanticMatchBlueprints({
      tags: ['royalties', 'music'],
      limit: 3
    });
    expect(results.length).toBeGreaterThan(0);
    results.forEach(r => {
      expect(r.score).toBeDefined();
      expect(r.embeddingSimilarity).toBeDefined();
    });
  });

  it('should semantic match with category filter', () => {
    const results = blueprintService.semanticMatchBlueprints({
      query: 'subscription',
      category: 'creator-economy',
      limit: 5
    });
    results.forEach(r => {
      expect(r.blueprint.category).toBe('creator-economy');
    });
  });

  it('should hybrid match via matchBlueprints with embedding similarity', () => {
    const results = blueprintService.matchBlueprints({
      query: 'streaming royalties',
      tags: ['royalties'],
      limit: 3
    });
    expect(results.length).toBeGreaterThan(0);
  });

  it('should handle semantic match with no results gracefully', () => {
    const results = blueprintService.semanticMatchBlueprints({
      query: 'zzzzzzzznonexistent',
      limit: 5
    });
    expect(Array.isArray(results)).toBe(true);
  });
});

const { GraphEngine, EDGE_TYPES, EDGE_TYPE_CONFIG } = require('../services/graphService');
const { EmbeddingEngine, tokenize, cosineSimilarity, buildEmbeddingText } = require('../services/embeddingService');

describe('Embedding Service', () => {
  const testBps = [
    { id: '1', name: 'Music Royalty Split', description: 'Split royalties for music creators', tags: ['music', 'royalty'], exampleUseCases: ['Artist payout'], components: ['Ledger'], bestPractices: ['Audit trail'] },
    { id: '2', name: 'Payment Gateway', description: 'Process payments for ecommerce', tags: ['payment', 'gateway'], exampleUseCases: ['Checkout'], components: ['Processor'], bestPractices: ['PCI compliance'] },
  ];

  it('should build index and generate embeddings', () => {
    const eng = new EmbeddingEngine();
    eng.buildIndex(testBps);
    expect(eng.vocabulary.length).toBeGreaterThan(0);
    expect(eng.index.size).toBe(2);
  });

  it('should compute cosine similarity between related blueprints', () => {
    const eng = new EmbeddingEngine();
    eng.buildIndex(testBps);
    const similar = eng.search('music artist royalty payout', 2);
    expect(similar.length).toBe(2);
    expect(similar[0].id).toBe('1');
    expect(similar[0].score).toBeGreaterThan(similar[1].score);
  });

  it('should compute cosine similarity correctly', () => {
    const a = new Float64Array([1, 0, 0]);
    const b = new Float64Array([1, 0, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
    const c = new Float64Array([-1, 0, 0]);
    expect(cosineSimilarity(a, c)).toBeCloseTo(-1.0, 5);
    const d = new Float64Array([0, 1, 0]);
    expect(cosineSimilarity(a, d)).toBeCloseTo(0, 5);
  });

  it('should upsert and remove from index', () => {
    const eng = new EmbeddingEngine();
    eng.buildIndex(testBps);
    eng.upsert({ id: '3', name: 'Test Pattern', description: 'A test', tags: ['test'], exampleUseCases: [], components: [], bestPractices: [] });
    expect(eng.index.size).toBe(3);
    eng.remove('3');
    expect(eng.index.size).toBe(2);
  });

  it('should generate embedding for arbitrary text', () => {
    const eng = new EmbeddingEngine();
    eng.buildIndex(testBps);
    const vec = eng.generateEmbedding('custom query text');
    expect(vec.length).toBe(eng.vocabulary.length);
  });

  it('should tokenize correctly with stop word removal', () => {
    const tokens = tokenize('The quick brown fox jumps over the lazy dog');
    expect(tokens.includes('the')).toBe(false);
    expect(tokens.includes('quick')).toBe(true);
    expect(tokens.includes('brown')).toBe(true);
  });

  it('should build embedding text from blueprint fields', () => {
    const text = buildEmbeddingText({ name: 'Test', description: 'Desc', tags: ['a', 'b'], exampleUseCases: ['Case 1'], components: ['Comp 1'], bestPractices: ['Best 1'] });
    expect(text).toContain('Test');
    expect(text).toContain('Desc');
    expect(text).toContain('a');
    expect(text).toContain('Case 1');
    expect(text).toContain('Comp 1');
    expect(text).toContain('Best 1');
  });
});

describe('Graph Service', () => {
  let g;

  beforeEach(() => {
    g = new GraphEngine();
    g.addNode({ id: 'bp_a', slug: 'blueprint-a', name: 'Blueprint A', category: 'cat1', complexity: 'low', tags: ['tag1'] });
    g.addNode({ id: 'bp_b', slug: 'blueprint-b', name: 'Blueprint B', category: 'cat1', complexity: 'medium', tags: ['tag2'] });
    g.addNode({ id: 'bp_c', slug: 'blueprint-c', name: 'Blueprint C', category: 'cat2', complexity: 'high', tags: ['tag3'] });
    g.addNode({ id: 'bp_d', slug: 'blueprint-d', name: 'Blueprint D', category: 'cat2', complexity: 'medium', tags: ['tag1', 'tag2'] });
  });

  it('should register nodes and retrieve them', () => {
    expect(g.getNode('bp_a').name).toBe('Blueprint A');
    expect(g.getNode('bp_b').slug).toBe('blueprint-b');
    expect(g.getNode('nonexistent')).toBeNull();
  });

  it('should add edges between nodes', () => {
    const edge = g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    expect(edge.id).toMatch(/^e_/);
    expect(edge.type).toBe('often-used-with');
    expect(edge.from).toBe('bp_a');
    expect(edge.to).toBe('bp_b');
  });

  it('should create symmetric edges for symmetric types', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    const edgesFromA = g.getEdgesFrom('bp_a');
    const edgesFromB = g.getEdgesFrom('bp_b');
    expect(edgesFromA.length).toBe(1);
    expect(edgesFromB.length).toBe(1);
    expect(edgesFromA[0].to).toBe('bp_b');
    expect(edgesFromB[0].to).toBe('bp_a');
  });

  it('should create asymmetric edges for non-symmetric types', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.PREREQUISITE_FOR, confidence: 0.8 });
    const edgesFromA = g.getEdgesFrom('bp_a');
    const edgesFromB = g.getEdgesFrom('bp_b');
    expect(edgesFromA.length).toBe(1);
    expect(edgesFromB.length).toBe(0);
  });

  it('should reject edges between non-existent nodes', () => {
    expect(() => g.addEdge({ from: 'bp_a', to: 'nonexistent', type: EDGE_TYPES.OFTEN_USED_WITH })).toThrow();
  });

  it('should reject unknown edge types', () => {
    expect(() => g.addEdge({ from: 'bp_a', to: 'bp_b', type: 'unknown-type' })).toThrow();
  });

  it('should remove edges', () => {
    const edge = g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    const ok = g.removeEdge(edge.id);
    expect(ok).toBe(true);
    expect(g.getEdgesFrom('bp_a').length).toBe(0);
  });

  it('should traverse graph up to max depth', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    g.addEdge({ from: 'bp_b', to: 'bp_c', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.8 });
    const results = g.traverse('bp_a', { maxDepth: 2 });
    expect(results.length).toBe(2);
    const nodeIds = results.map(r => r.nodeId).sort();
    expect(nodeIds).toEqual(['bp_b', 'bp_c']);
  });

  it('should compute connectivity scores', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    g.addEdge({ from: 'bp_b', to: 'bp_c', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.8 });
    const scores = g.getConnectivityScores(['bp_a'], ['bp_a', 'bp_b', 'bp_c', 'bp_d']);
    expect(scores['bp_a']).toBeGreaterThan(0);
    expect(scores['bp_b']).toBeGreaterThan(0);
    expect(scores['bp_d']).toBe(0);
  });

  it('should return related blueprints ranked by score', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    g.addEdge({ from: 'bp_a', to: 'bp_c', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.5 });
    const related = g.getRelated('bp_a');
    expect(related.length).toBe(2);
    expect(related[0].blueprintId).toBe('bp_b');
    expect(related[0].score).toBeGreaterThan(related[1].score);
  });

  it('should filter related by minConfidence', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    g.addEdge({ from: 'bp_a', to: 'bp_c', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.2 });
    const related = g.getRelated('bp_a', { minConfidence: 0.5 });
    expect(related.length).toBe(1);
    expect(related[0].blueprintId).toBe('bp_b');
  });

  it('should generate recommendations from seed nodes', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    g.addEdge({ from: 'bp_a', to: 'bp_c', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.7 });
    const recs = g.getRecommendations(['bp_a']);
    expect(recs.length).toBe(2);
  });

  it('should exclude seed nodes from recommendations', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    const recs = g.getRecommendations(['bp_a', 'bp_b']);
    expect(recs.length).toBe(0);
  });

  it('should create bundles from blueprint sets', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    g.addEdge({ from: 'bp_b', to: 'bp_c', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.8 });
    const bundle = g.getBundle(['bp_a', 'bp_b', 'bp_c'], { name: 'Test Bundle' });
    expect(bundle.name).toBe('Test Bundle');
    expect(bundle.blueprints.length).toBe(3);
    expect(bundle.edgeCount).toBeGreaterThan(0);
    expect(bundle.avgConnectivity).toBeGreaterThan(0);
  });

  it('should record usage and return co-occurrences', () => {
    g.recordUsage('bp_a', 'bp_b');
    g.recordUsage('bp_a', 'bp_b');
    g.recordUsage('bp_a', 'bp_b');
    g.recordUsage('bp_c', 'bp_d');
    g.recordUsage('bp_c', 'bp_d');
    const coocs = g.getCoOccurrences(2);
    expect(coocs.length).toBe(2);
    expect(coocs[0].count).toBe(3);
  });

  it('should remove nodes and their edges', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    g.removeNode('bp_a');
    expect(g.getNode('bp_a')).toBeNull();
    expect(g.getEdgesFrom('bp_a').length).toBe(0);
    expect(g.getEdgesTo('bp_a').length).toBe(0);
  });

  it('should return graph info with stats', () => {
    g.addEdge({ from: 'bp_a', to: 'bp_b', type: EDGE_TYPES.OFTEN_USED_WITH, confidence: 0.9 });
    const info = g.getInfo();
    expect(info.nodes).toBe(4);
    expect(info.edges).toBeGreaterThan(0);
    expect(info.edgeTypes).toBeGreaterThan(0);
    expect(info.edgeTypeBreakdown).toBeDefined();
  });
});

describe('Blueprint Service — Graph Integration', () => {
  beforeEach(() => {
    blueprintService.seedBlueprints();
  });

  it('should seed graph nodes for all blueprints', () => {
    const info = blueprintService.getGraphInfo();
    expect(info.nodes).toBeGreaterThanOrEqual(10);
    expect(info.edges).toBeGreaterThan(0);
  });

  it('should get graph node with edges', () => {
    const node = blueprintService.getGraphNode(
      blueprintService.getBlueprintBySlug('creator-royalty-split').id
    );
    expect(node).not.toBeNull();
    expect(node.blueprint).toBeDefined();
    expect(node.edges.length).toBeGreaterThan(0);
  });

  it('should return null for non-existent graph node', () => {
    const node = blueprintService.getGraphNode('nonexistent');
    expect(node).toBeNull();
  });

  it('should get related blueprints ranked by score', () => {
    const bp = blueprintService.getBlueprintBySlug('micro-royalty-streaming');
    const related = blueprintService.getGraphRelated(bp.id, { limit: 3 });
    expect(related.length).toBeGreaterThan(0);
    expect(related[0].score).toBeGreaterThan(0);
    expect(related[0].blueprint).toBeDefined();
  });

  it('should get graph recommendations from seeds', () => {
    const bp = blueprintService.getBlueprintBySlug('creator-royalty-split');
    const recs = blueprintService.getGraphRecommendations([bp.id], { limit: 3 });
    expect(recs.length).toBeGreaterThan(0);
    recs.forEach(r => {
      expect(r.blueprint).toBeDefined();
      expect(r.sourceBlueprint).toBeDefined();
    });
  });

  it('should create a blueprint bundle', () => {
    const bp1 = blueprintService.getBlueprintBySlug('creator-royalty-split');
    const bp2 = blueprintService.getBlueprintBySlug('micro-royalty-streaming');
    const bp3 = blueprintService.getBlueprintBySlug('event-driven-settlement');
    const bundle = blueprintService.getGraphBundle([bp1.id, bp2.id, bp3.id], { name: 'Royalty Stack Bundle' });
    expect(bundle.name).toBe('Royalty Stack Bundle');
    expect(bundle.blueprints.length).toBe(3);
    expect(bundle.edgeCount).toBeGreaterThan(0);
  });

  it('should include graph scores in semantic match results', () => {
    const results = blueprintService.semanticMatchBlueprints({
      query: 'real-time event driven payout',
      limit: 5
    });
    expect(results.length).toBeGreaterThan(0);
    results.forEach(r => {
      expect(r.graphScore).toBeDefined();
      expect(typeof r.graphScore).toBe('number');
    });
    const topResult = results[0];
    expect(topResult.score).toBeGreaterThan(0);
    expect(topResult.embeddingSimilarity).toBeGreaterThan(0);
  });

  it('should boost graph-connected blueprints in semantic scoring', () => {
    const results = blueprintService.semanticMatchBlueprints({
      query: 'music generation ai',
      limit: 10
    });
    expect(results.length).toBeGreaterThan(0);
  });

  it('should add graph edge manually and verify', () => {
    const bp1 = blueprintService.getBlueprintBySlug('creator-royalty-split');
    const bp2 = blueprintService.getBlueprintBySlug('ai-music-generation-pipeline');
    const edge = blueprintService.addGraphEdge({
      fromId: bp1.id,
      toId: bp2.id,
      type: EDGE_TYPES.RECOMMENDED_PAIRING,
      confidence: 0.5,
    });
    expect(edge).not.toBeNull();
    expect(edge.type).toBe('recommended-pairing');
    const edges = blueprintService.getGraphEdges(bp1.id);
    expect(edges.from.some(e => e.to === bp2.id)).toBe(true);
  });

  it('should remove graph edge', () => {
    const bp1 = blueprintService.getBlueprintBySlug('creator-royalty-split');
    const bp2 = blueprintService.getBlueprintBySlug('micro-royalty-streaming');
    const existingFrom = blueprintService.getGraphEdges(bp1.id).from;
    const edgeToRemove = existingFrom.find(e => e.to === bp2.id);
    if (edgeToRemove) {
      const ok = blueprintService.removeGraphEdge(edgeToRemove.id);
      expect(ok).toBe(true);
      const updated = blueprintService.getGraphEdges(bp1.id);
      expect(updated.from.some(e => e.id === edgeToRemove.id)).toBe(false);
    }
  });

  it('should sync graph on blueprint create', () => {
    const bp = blueprintService.createBlueprint({
      name: 'Graph Test Pattern',
      description: 'Testing graph sync',
      tags: ['test']
    });
    const node = blueprintService.getGraphNode(bp.id);
    expect(node).not.toBeNull();
    expect(node.node.name).toBe('Graph Test Pattern');
  });

  it('should sync graph on blueprint delete', () => {
    const bp = blueprintService.createBlueprint({ name: 'Delete From Graph', tags: ['test'] });
    blueprintService.deleteBlueprint(bp.id);
    const node = blueprintService.getGraphNode(bp.id);
    expect(node).toBeNull();
  });

  it('should return graph info with correct stats', () => {
    const info = blueprintService.getGraphInfo();
    expect(info.nodes).toBeGreaterThan(0);
    expect(info.edges).toBeGreaterThan(0);
    expect(info.edgeTypes).toBeGreaterThan(0);
  });
});
