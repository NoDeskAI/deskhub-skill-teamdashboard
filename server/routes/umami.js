import { Router } from 'express';
import { getCache, setCache } from '../middleware/cache.js';
import { wrapResponse } from '../utils/meta.js';

const router = Router();

const BASE = () => process.env.UMAMI_BASE || 'https://umami.deskclaw.me';
const WEBSITE_ID = () => process.env.UMAMI_WEBSITE_ID;
const DATA_AVAILABLE_SINCE = '2026-03-29';
const DATA_SINCE_MS = new Date('2026-03-29T00:00:00+08:00').getTime();

// --- Token 管理 ---
let token = null;
let tokenExpiry = 0;

async function ensureToken() {
  if (token && Date.now() < tokenExpiry) return token;

  const res = await fetch(`${BASE()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.UMAMI_USERNAME,
      password: process.env.UMAMI_PASSWORD,
    }),
  });

  if (!res.ok) throw new Error(`Umami login failed: ${res.status}`);
  const json = await res.json();
  token = json.token;
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // 23 小时
  console.log('[umami] Token acquired, expires in 23h');
  return token;
}

// --- 通用 fetch ---
async function fetchUmami(path) {
  const t = await ensureToken();
  const url = `${BASE()}/api/websites/${WEBSITE_ID()}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
  });
  if (res.status === 401) {
    // token 过期，重试一次
    token = null;
    const t2 = await ensureToken();
    const res2 = await fetch(url, {
      headers: { Authorization: `Bearer ${t2}`, Accept: 'application/json' },
    });
    if (!res2.ok) throw new Error(`Umami ${res2.status}: ${url}`);
    return res2.json();
  }
  if (!res.ok) throw new Error(`Umami ${res.status}: ${url}`);
  return res.json();
}

// --- startAt 截断 ---
function clampStartAt(startAt) {
  const v = Number(startAt);
  return v < DATA_SINCE_MS ? DATA_SINCE_MS : v;
}

// --- 构建 meta ---
function umamiMeta(startAt, endAt, cached = false, ttl = 0) {
  return {
    source: 'umami',
    window: { start: new Date(Number(startAt)).toISOString().slice(0, 10), end: new Date(Number(endAt)).toISOString().slice(0, 10) },
    dataAvailableSince: DATA_AVAILABLE_SINCE,
    cached,
    ...(cached && ttl > 0 ? { ttl } : {}),
  };
}

// --- 错误响应 ---
function errorResponse(res, err) {
  console.error('[proxy/umami]', err.message);
  res.status(502).json({
    data: null,
    meta: { source: 'umami', fetchedAt: new Date().toISOString(), cached: false },
    error: err.message,
  });
}

const TTL = 600; // 10 分钟

// --- GET /api/proxy/umami/stats ---
router.get('/stats', async (req, res) => {
  try {
    const { startAt, endAt } = req.query;
    if (!startAt || !endAt) return res.status(400).json({ error: 'startAt and endAt required' });
    const sa = clampStartAt(startAt);
    const cacheKey = `umami:stats:${sa}:${endAt}`;
    const hit = getCache(cacheKey);
    if (hit) return res.json(wrapResponse(hit.data, umamiMeta(sa, endAt, true, hit.ttl)));

    const data = await fetchUmami(`/stats?startAt=${sa}&endAt=${endAt}`);
    setCache(cacheKey, data, TTL);
    res.json(wrapResponse(data, umamiMeta(sa, endAt)));
  } catch (err) { errorResponse(res, err); }
});

// --- GET /api/proxy/umami/pageviews ---
router.get('/pageviews', async (req, res) => {
  try {
    const { startAt, endAt, unit = 'day' } = req.query;
    if (!startAt || !endAt) return res.status(400).json({ error: 'startAt and endAt required' });
    const sa = clampStartAt(startAt);
    const cacheKey = `umami:pv:${sa}:${endAt}:${unit}`;
    const hit = getCache(cacheKey);
    if (hit) return res.json(wrapResponse(hit.data, umamiMeta(sa, endAt, true, hit.ttl)));

    const data = await fetchUmami(`/pageviews?startAt=${sa}&endAt=${endAt}&unit=${unit}`);
    setCache(cacheKey, data, TTL);
    res.json(wrapResponse(data, umamiMeta(sa, endAt)));
  } catch (err) { errorResponse(res, err); }
});

// --- GET /api/proxy/umami/metrics ---
router.get('/metrics', async (req, res) => {
  try {
    const { type, startAt, endAt } = req.query;
    if (!type || !startAt || !endAt) return res.status(400).json({ error: 'type, startAt and endAt required' });
    const sa = clampStartAt(startAt);
    const cacheKey = `umami:metrics:${type}:${sa}:${endAt}`;
    const hit = getCache(cacheKey);
    if (hit) return res.json(wrapResponse(hit.data, umamiMeta(sa, endAt, true, hit.ttl)));

    const data = await fetchUmami(`/metrics?type=${type}&startAt=${sa}&endAt=${endAt}`);
    setCache(cacheKey, data, TTL);
    res.json(wrapResponse(data, umamiMeta(sa, endAt)));
  } catch (err) { errorResponse(res, err); }
});

// --- GET /api/proxy/umami/event-data ---
router.get('/event-data', async (req, res) => {
  try {
    const { startAt, endAt } = req.query;
    if (!startAt || !endAt) return res.status(400).json({ error: 'startAt and endAt required' });
    const sa = clampStartAt(startAt);
    const cacheKey = `umami:events:${sa}:${endAt}`;
    const hit = getCache(cacheKey);
    if (hit) return res.json(wrapResponse(hit.data, umamiMeta(sa, endAt, true, hit.ttl)));

    const data = await fetchUmami(`/event-data/fields?startAt=${sa}&endAt=${endAt}`);
    setCache(cacheKey, data, TTL);
    res.json(wrapResponse(data, umamiMeta(sa, endAt)));
  } catch (err) { errorResponse(res, err); }
});

// --- GET /api/proxy/umami/active ---
router.get('/active', async (_req, res) => {
  try {
    const data = await fetchUmami('/active');
    res.json(wrapResponse(data, { source: 'umami', cached: false }));
  } catch (err) { errorResponse(res, err); }
});

export default router;
