const express = require('express');
const router = express.Router();
const blueprintService = require('../services/blueprintService');

router.get('/', (req, res) => {
  const { limit, offset, category, tags, complexity } = req.query;
  const parsedTags = tags ? tags.split(',').map(t => t.trim()) : [];
  const result = blueprintService.listBlueprints({
    limit: limit ? parseInt(limit, 10) : 20,
    offset: offset ? parseInt(offset, 10) : 0,
    category,
    tags: parsedTags,
    complexity
  });
  res.json(result);
});

router.get('/match', (req, res) => {
  const { query, category, tags, complexity, limit } = req.query;
  const parsedTags = tags ? tags.split(',').map(t => t.trim()) : [];
  const results = blueprintService.matchBlueprints({
    query, category,
    tags: parsedTags,
    complexity,
    limit: limit ? parseInt(limit, 10) : 5
  });
  res.json({ items: results });
});

router.get('/semantic-match', (req, res) => {
  const { query, category, tags, complexity, limit } = req.query;
  const parsedTags = tags ? tags.split(',').map(t => t.trim()) : [];
  const results = blueprintService.semanticMatchBlueprints({
    query, category,
    tags: parsedTags,
    complexity,
    limit: limit ? parseInt(limit, 10) : 5
  });
  res.json({ items: results, embedding: blueprintService.getEmbeddingInfo() });
});

router.get('/embedding-info', (req, res) => {
  res.json(blueprintService.getEmbeddingInfo());
});

router.get('/graph/info', (req, res) => {
  res.json(blueprintService.getGraphInfo());
});

router.get('/graph/node/:id', (req, res) => {
  const result = blueprintService.getGraphNode(req.params.id);
  if (!result) return res.status(404).json({ error: 'Blueprint not found' });
  res.json(result);
});

router.get('/graph/edges/:id', (req, res) => {
  const result = blueprintService.getGraphEdges(req.params.id);
  if (!result) return res.status(404).json({ error: 'Blueprint not found' });
  res.json(result);
});

router.get('/graph/related/:id', (req, res) => {
  const { limit, minConfidence } = req.query;
  const result = blueprintService.getGraphRelated(req.params.id, {
    limit: limit ? parseInt(limit, 10) : 5,
    minConfidence: minConfidence ? parseFloat(minConfidence) : 0.3,
  });
  if (!result) return res.status(404).json({ error: 'Blueprint not found' });
  res.json({ items: result });
});

router.get('/graph/recommendations', (req, res) => {
  const { seeds, limit, minConfidence } = req.query;
  if (!seeds) return res.status(400).json({ error: 'seeds parameter required (comma-separated ids)' });
  const seedIds = seeds.split(',').map(s => s.trim());
  const result = blueprintService.getGraphRecommendations(seedIds, {
    limit: limit ? parseInt(limit, 10) : 5,
    minConfidence: minConfidence ? parseFloat(minConfidence) : 0.2,
  });
  res.json({ items: result });
});

router.get('/graph/bundle', (req, res) => {
  const { ids, name, description } = req.query;
  if (!ids) return res.status(400).json({ error: 'ids parameter required (comma-separated blueprint ids)' });
  const blueprintIds = ids.split(',').map(s => s.trim());
  const result = blueprintService.getGraphBundle(blueprintIds, { name, description });
  res.json(result);
});

router.post('/graph/edges', (req, res) => {
  const { fromId, toId, type, confidence, source, metadata } = req.body;
  if (!fromId || !toId || !type) return res.status(400).json({ error: 'fromId, toId, and type are required' });
  const edge = blueprintService.addGraphEdge({ fromId, toId, type, confidence, source, metadata });
  if (!edge) return res.status(404).json({ error: 'One or both blueprints not found' });
  res.status(201).json(edge);
});

router.delete('/graph/edges/:edgeId', (req, res) => {
  const ok = blueprintService.removeGraphEdge(req.params.edgeId);
  if (!ok) return res.status(404).json({ error: 'Edge not found' });
  res.json({ success: true });
});

router.get('/slug/:slug', (req, res) => {
  const { slug } = req.params;
  const bp = blueprintService.getBlueprintBySlug(slug);
  if (!bp) return res.status(404).json({ error: 'Blueprint not found' });
  res.json(bp);
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const bp = blueprintService.getBlueprint(id);
  if (!bp) return res.status(404).json({ error: 'Blueprint not found' });
  res.json(bp);
});

router.post('/', (req, res) => {
  const bp = blueprintService.createBlueprint(req.body);
  res.status(201).json(bp);
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const updated = blueprintService.updateBlueprint(id, req.body);
  if (!updated) return res.status(404).json({ error: 'Blueprint not found' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const ok = blueprintService.deleteBlueprint(id);
  if (!ok) return res.status(404).json({ error: 'Blueprint not found' });
  res.json({ success: true });
});

module.exports = router;