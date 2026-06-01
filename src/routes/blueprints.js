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
