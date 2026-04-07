import { get } from './api.js';

/**
 * 日期字符串 → 毫秒时间戳
 */
function toMs(dateStr) {
  return new Date(dateStr + 'T00:00:00+08:00').getTime();
}

/**
 * 默认时间窗口：最近 7 天
 */
function defaultWindow() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); // 明天 0 点
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    startAt: start.getTime(),
    endAt: end.getTime(),
  };
}

/**
 * 获取 PV/UV/visits/bounces
 */
export async function getStats(startDate, endDate) {
  const w = defaultWindow();
  const startAt = startDate ? toMs(startDate) : w.startAt;
  const endAt = endDate ? toMs(endDate) : w.endAt;

  const res = await get(`/api/proxy/umami/stats?startAt=${startAt}&endAt=${endAt}`);
  if (res.error || !res.data) return null;
  return { ...res.data, meta: res.meta };
}

/**
 * 获取热门行为事件 — 从 metrics?type=event 获取事件排行
 * 注意：Umami 埋点未记录搜索关键词内容，只有事件计数
 */
export async function getHotEvents(startDate, endDate) {
  const w = defaultWindow();
  const startAt = startDate ? toMs(startDate) : w.startAt;
  const endAt = endDate ? toMs(endDate) : w.endAt;

  const res = await get(`/api/proxy/umami/metrics?type=event&startAt=${startAt}&endAt=${endAt}`);
  if (res.error || !res.data) return [];

  const events = Array.isArray(res.data) ? res.data : [];
  return events
    .map(e => ({ term: e.x, count: e.y }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

/**
 * 获取事件聚合（如 skill_download 次数）
 */
export async function getEventMetrics(startDate, endDate) {
  const w = defaultWindow();
  const startAt = startDate ? toMs(startDate) : w.startAt;
  const endAt = endDate ? toMs(endDate) : w.endAt;

  const res = await get(`/api/proxy/umami/metrics?type=event&startAt=${startAt}&endAt=${endAt}`);
  if (res.error || !res.data) return [];
  return Array.isArray(res.data) ? res.data : [];
}
