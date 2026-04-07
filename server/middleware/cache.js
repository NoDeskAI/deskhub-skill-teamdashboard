/**
 * 简易内存缓存 — Map + TTL
 */
const store = new Map();

export function getCache(key) {
  const entry = store.get(key);
  if (!entry) return null;
  const remaining = entry.expiry - Date.now();
  if (remaining <= 0) {
    store.delete(key);
    return null;
  }
  return { data: entry.data, ttl: Math.round(remaining / 1000) };
}

export function setCache(key, data, ttlSeconds) {
  store.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 });
}

export function clearAll() {
  store.clear();
}
