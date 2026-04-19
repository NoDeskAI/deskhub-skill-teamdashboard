/**
 * 技能加权评分排序
 * 两种排序视角：热门（偏下载/查看）和活跃（偏更新/迭代）
 */

// 归一化到 0-1 范围
function normalize(value, max) {
  return max > 0 ? Math.min(value / max, 1) : 0;
}

/**
 * 热门技能排序 — 偏重下载量、查看量、迭代成熟度
 */
export function rankByPopularity(skills) {
  const maxDl = Math.max(...skills.map(s => s.dl || 0), 1);
  const maxViews = Math.max(...skills.map(s => s.views || 0), 1);
  const maxIters = Math.max(...skills.map(s => s.iters || 0), 1);

  // views 可能为 null（API 无此字段），此时权重转移到 dl
  const hasViews = skills.some(s => s.views != null && s.views > 0);
  const wDl = hasViews ? 0.4 : 0.6;
  const wViews = hasViews ? 0.35 : 0;
  const wIters = hasViews ? 0.25 : 0.4;

  return [...skills].map(sk => ({
    ...sk,
    _score: (
      normalize(sk.dl || 0, maxDl) * wDl +
      normalize(sk.views || 0, maxViews) * wViews +
      normalize(sk.iters || 0, maxIters) * wIters
    ),
  })).sort((a, b) => b._score - a._score);
}

/**
 * 近期活跃排序 — 偏重更新时间、迭代频率
 */
export function rankByActivity(skills) {
  const maxIters = Math.max(...skills.map(s => s.iters || 0), 1);

  // 日期越新分越高（简单用字符串比较，mock 数据格式统一为 MM-DD）
  const dates = skills.map(s => s.updated);
  const sortedDates = [...new Set(dates)].sort();
  const dateRank = {};
  sortedDates.forEach((d, i) => { dateRank[d] = i / Math.max(sortedDates.length - 1, 1); });

  return [...skills].map(sk => ({
    ...sk,
    _score: (
      (dateRank[sk.updated] || 0) * 0.5 +
      normalize(sk.iters || 0, maxIters) * 0.3 +
      (sk.status === "iterating" || sk.status === "testing" ? 0.2 : 0)
    ),
  })).sort((a, b) => b._score - a._score);
}
