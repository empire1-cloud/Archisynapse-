/**
 * Embedding Service v0.2 — Local TF-IDF vector engine
 *
 * Produces dense-ish semantic vectors from text using TF-IDF weighting.
 * Swappable: replace generateEmbedding() with any API (OpenAI, Cohere, etc.)
 * and the rest of the system stays identical.
 *
 * Model: soulfire-embed-v1 (local TF-IDF, dims = vocabulary size)
 * Target swap: text-embedding-3-small (OpenAI, 1536 dims)
 */

const stopWords = new Set([
  'a', 'an', 'the', 'is', 'it', 'in', 'on', 'of', 'to', 'for',
  'and', 'or', 'but', 'with', 'at', 'by', 'from', 'as', 'be', 'this',
  'that', 'these', 'those', 'are', 'was', 'were', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'about', 'into', 'over', 'after', 'before', 'between',
  'under', 'above', 'below', 'out', 'off', 'up', 'down', 'just',
  'also', 'very', 'too', 'not', 'no', 'nor', 'so', 'if', 'then', 'than'
]);

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !stopWords.has(t));
}

function buildCorpus(blueprints) {
  const docFreq = {};
  const totalDocs = blueprints.length;

  for (const bp of blueprints) {
    const text = buildEmbeddingText(bp);
    const tokens = [...new Set(tokenize(text))];
    for (const t of tokens) {
      docFreq[t] = (docFreq[t] || 0) + 1;
    }
  }

  const idf = {};
  for (const [term, df] of Object.entries(docFreq)) {
    idf[term] = Math.log((totalDocs + 1) / (df + 1)) + 1;
  }

  const vocabulary = Object.keys(idf).sort();
  return { vocabulary, idf };
}

function buildEmbeddingText(bp) {
  return [
    bp.name || '',
    bp.description || '',
    ...(bp.tags || []),
    ...(bp.exampleUseCases || []),
    ...(bp.components || []),
    ...(bp.bestPractices || []),
  ].join(' ');
}

function vectorize(text, vocabulary, idf) {
  const tokens = tokenize(text);
  const tf = {};
  for (const t of tokens) {
    tf[t] = (tf[t] || 0) + 1;
  }

  const vec = new Float64Array(vocabulary.length);
  const tokenCount = tokens.length || 1;
  for (let i = 0; i < vocabulary.length; i++) {
    const term = vocabulary[i];
    const termFreq = (tf[term] || 0) / tokenCount;
    const invDocFreq = idf[term] || 1.0;
    vec[i] = termFreq * invDocFreq;
  }

  return vec;
}

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

class EmbeddingEngine {
  constructor() {
    this.vocabulary = [];
    this.idf = {};
    this.index = new Map();
    this.modelName = 'soulfire-embed-v1';
    this.embeddingVersion = '2026-06-01';
  }

  buildIndex(blueprints) {
    const corpus = buildCorpus(blueprints);
    this.vocabulary = corpus.vocabulary;
    this.idf = corpus.idf;

    for (const bp of blueprints) {
      const text = buildEmbeddingText(bp);
      const vec = vectorize(text, this.vocabulary, this.idf);
      this.index.set(bp.id, { id: bp.id, embedding: Array.from(vec) });
    }
  }

  generateEmbedding(text) {
    const vec = vectorize(text, this.vocabulary, this.idf);
    return Array.from(vec);
  }

  computeSimilarity(vecA, vecB) {
    const a = vecA instanceof Float64Array ? vecA : new Float64Array(vecA);
    const b = vecB instanceof Float64Array ? vecB : new Float64Array(vecB);
    return cosineSimilarity(a, b);
  }

  search(query, limit = 10) {
    if (this.index.size === 0) return [];

    const queryVec = new Float64Array(this.generateEmbedding(query));

    const results = [];
    for (const entry of this.index.values()) {
      const bpVec = new Float64Array(entry.embedding);
      const score = cosineSimilarity(queryVec, bpVec);
      results.push({ id: entry.id, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  upsert(blueprint) {
    const text = buildEmbeddingText(blueprint);
    const vec = vectorize(text, this.vocabulary, this.idf);
    this.index.set(blueprint.id, { id: blueprint.id, embedding: Array.from(vec) });
  }

  remove(id) {
    this.index.delete(id);
  }

  getInfo() {
    return {
      model: this.modelName,
      version: this.embeddingVersion,
      dimensions: this.vocabulary.length,
      indexed: this.index.size,
      vocabularyTerms: this.vocabulary.length,
      engine: 'local-tfidf'
    };
  }
}

module.exports = { EmbeddingEngine, tokenize, cosineSimilarity, buildEmbeddingText };
