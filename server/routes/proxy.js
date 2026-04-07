import { Router } from 'express';
import { getCache, setCache, clearAll } from '../middleware/cache.js';
import { wrapResponse } from '../utils/meta.js';

const router = Router();
const BASE = process.env.DESKHUB_BASE || 'https://skills.deskclaw.me';

// --- TTL 配置（秒）---
const TTL = {
  skills: 600,      // 列表 10 分钟
  detail: 1800,     // 详情 30 分钟
  versions: 300,    // 版本流 5 分钟
};

// --- 通用 fetch ---
async function fetchUpstream(path) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`DeskHub ${res.status}: ${url}`);
  return res.json();
}

// --- GET /api/proxy/deskhub/skills ---
router.get('/skills', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const cacheKey = `skills:${qs}`;
    const hit = getCache(cacheKey);
    if (hit) return res.json(wrapResponse(hit.data, { source: 'deskhub', cached: true, ttl: hit.ttl }));

    const json = await fetchUpstream(`/api/v1/skills${qs ? '?' + qs : ''}`);
    setCache(cacheKey, json.data, TTL.skills);
    res.json(wrapResponse(json.data, { source: 'deskhub' }));
  } catch (err) {
    console.error('[proxy/deskhub/skills]', err.message);
    res.status(502).json({ data: null, meta: { source: 'deskhub', fetchedAt: new Date().toISOString(), cached: false }, error: err.message });
  }
});

// --- GET /api/proxy/deskhub/skills/:slug ---
router.get('/skills/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const cacheKey = `detail:${slug}`;
    const hit = getCache(cacheKey);
    if (hit) return res.json(wrapResponse(hit.data, { source: 'deskhub', cached: true, ttl: hit.ttl }));

    const json = await fetchUpstream(`/api/v1/skills/${encodeURIComponent(slug)}`);
    setCache(cacheKey, json.data, TTL.detail);
    res.json(wrapResponse(json.data, { source: 'deskhub' }));
  } catch (err) {
    console.error('[proxy/deskhub/skills/:slug]', err.message);
    res.status(502).json({ data: null, meta: { source: 'deskhub', fetchedAt: new Date().toISOString(), cached: false }, error: err.message });
  }
});

// --- GET /api/proxy/deskhub/versions ---
router.get('/versions', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const cacheKey = `versions:${qs}`;
    const hit = getCache(cacheKey);
    if (hit) return res.json(wrapResponse(hit.data, { source: 'deskhub', window: req.query.since ? { start: req.query.since } : 'cumulative', cached: true, ttl: hit.ttl }));

    const json = await fetchUpstream(`/api/v1/versions/recent${qs ? '?' + qs : ''}`);
    const windowVal = req.query.since ? { start: req.query.since } : 'cumulative';
    setCache(cacheKey, json.data, TTL.versions);
    res.json(wrapResponse(json.data, { source: 'deskhub', window: windowVal }));
  } catch (err) {
    console.error('[proxy/deskhub/versions]', err.message);
    res.status(502).json({ data: null, meta: { source: 'deskhub', fetchedAt: new Date().toISOString(), cached: false }, error: err.message });
  }
});

// --- POST /api/proxy/deskhub/cache/clear ---
router.post('/cache/clear', (_req, res) => {
  clearAll();
  res.json({ ok: true, message: '缓存已清除' });
});

export default router;
