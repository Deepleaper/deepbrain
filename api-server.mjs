/**
 * DeepBrain API Server — Express + DeepBrain SDK
 * Next.js 前端通过 API 调用数据
 */
import express from 'express';
import cors from 'cors';
import { Brain } from 'deepbrain';

const app = express();
app.use(cors());
const PORT = 4000;

const brain = new Brain({
  embedding_provider: 'gemini',
  api_key: process.env.GEMINI_API_KEY || '',
  database: './deepbrain-data',
});
await brain.connect();
console.log('🧠 Brain connected');

// List all pages
app.get('/api/pages', async (req, res) => {
  const tag = req.query.tag;
  const pages = await brain.list(tag ? { tag } : undefined);
  // Attach tags to each page
  const result = [];
  for (const p of pages) {
    const tags = await brain.getTags(p.slug);
    result.push({ ...p, tags });
  }
  res.json(result);
});

// Get single page
app.get('/api/pages/:slug', async (req, res) => {
  const page = await brain.get(decodeURIComponent(req.params.slug));
  if (!page) return res.status(404).json({ error: 'not found' });
  const tags = await brain.getTags(page.slug);
  const links = await brain.getLinks(page.slug);
  const backlinks = await brain.getBacklinks(page.slug);
  res.json({ ...page, tags, links, backlinks });
});

// Stats
app.get('/api/stats', async (req, res) => {
  res.json(await brain.stats());
});

// All tags with counts
app.get('/api/tags', async (req, res) => {
  const pages = await brain.list();
  const tagMap = {};
  for (const p of pages) {
    const tags = await brain.getTags(p.slug);
    for (const t of tags) tagMap[t] = (tagMap[t] || 0) + 1;
  }
  const result = Object.entries(tagMap)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
  res.json(result);
});

// Search
app.get('/api/search', async (req, res) => {
  const q = req.query.q || '';
  if (!q) return res.json([]);
  const results = await brain.search(q, { limit: 20 });
  res.json(results);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 DeepBrain API running at http://localhost:${PORT}`);
});
