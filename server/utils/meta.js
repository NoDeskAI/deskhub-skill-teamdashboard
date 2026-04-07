/**
 * 统一响应包装器 — 每个代理端点返回 { data, meta }
 */
export function wrapResponse(data, { source, window = 'cumulative', cached = false, ttl = 0 }) {
  return {
    data,
    meta: {
      source,
      window,
      fetchedAt: new Date().toISOString(),
      cached,
      ...(cached && ttl > 0 ? { ttl } : {}),
    },
  };
}
