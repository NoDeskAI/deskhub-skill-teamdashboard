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
  const maxDl = Math.max(...skills.map(s => s.dl), 1);
  const maxViews = Math.max(...skills.map(s => s.views), 1);
  const maxIters = Math.max(...skills.map(s => s.iters), 1);

  return [...skills].map(sk => ({
    ...sk,
    _score: (
      normalize(sk.dl, maxDl) * 0.4 +
      normalize(sk.views, maxViews) * 0.35 +
      normalize(sk.iters, maxIters) * 0.25
    ),
  })).sort((a, b) => b._score - a._score);
}

/**
 * 近期活跃排序 — 偏重更新时间、迭代频率
 */
export function rankByActivity(skills) {
  const maxIters = Math.max(...skills.map(s => s.iters), 1);

  // 日期越新分越高（简单用字符串比较，mock 数据格式统一为 MM-DD）
  const dates = skills.map(s => s.updated);
  const sortedDates = [...new Set(dates)].sort();
  const dateRank = {};
  sortedDates.forEach((d, i) => { dateRank[d] = i / Math.max(sortedDates.length - 1, 1); });

  return [...skills].map(sk => ({
    ...sk,
    _score: (
      (dateRank[sk.updated] || 0) * 0.5 +
      normalize(sk.iters, maxIters) * 0.3 +
      (sk.status === "iterating" || sk.status === "testing" ? 0.2 : 0)
    ),
  })).sort((a, b) => b._score - a._score);
}
