import { get } from './api.js';
import { SKILLS } from '../constants/mock-data.js';

const USE_API = import.meta.env.VITE_USE_API !== 'false';

/**
 * 日期格式化 ISO → "MM-DD"
 */
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 推断 source：keeper-bot=自动解析, sourceUrl 含 github=GitHub 导入, 其他=手动
 */
function inferSource(item) {
  if (item.ownerHandle === 'keeper-bot') return '自动解析';
  if (item.sourceUrl && item.sourceUrl.includes('github')) return 'GitHub';
  return '手动上传';
}

/**
 * API 返回 → 前端 skill 格式
 * 保持与 mock-data.js 中 SKILLS 结构一致，组件无需改字段名
 */
function transformSkill(item, versionMap) {
  const verInfo = versionMap?.[item.slug];
  return {
    name: item.displayName,
    slug: item.slug,
    status: null,                    // DeskHub 无此字段，null 表示"未标注"
    ver: verInfo?.version || '—',
    cat: 'skill',                    // DeskHub 只有 skill
    source: inferSource(item),
    iters: 0,                        // 需详情接口，暂默认
    updated: fmtDate(item.updatedAt),
    dl: item.statsDownloads || 0,
    views: null,                     // API 无此字段
    desc: item.summary || '',
    qualityScore: item.qualityScore || 0,
    successRate: null,               // 需后端埋点，暂无
    avgResponseTime: null,           // 需后端埋点，暂无
    userRating: null,                // 用 qualityScore 替代
    weeklyActiveUsers: null,         // Phase 2 从 Umami 获取
    searchHits: null,                // Phase 2 从 Umami 获取
    dlTrend: null,                   // Phase 2 从 Umami 获取
    changelog: [],                   // 需详情接口，暂空
    // 新字段（API 独有）
    tags: item.tags || [],
    scenes: item.scenes || [],
    badges: item.badges || [],
    ownerHandle: item.ownerHandle,
    ownerAvatar: item.ownerAvatar,
    sourceUrl: item.sourceUrl,
    createdAt: item.createdAt,
  };
}

/**
 * 获取技能列表 — 合并列表 + 版本流
 */
export async function getSkills({ pageSize = 100, page = 1, sort = 'newest' } = {}) {
  if (!USE_API) return SKILLS;

  const [skillsRes, versionsRes] = await Promise.all([
    get(`/api/proxy/deskhub/skills?pageSize=${pageSize}&page=${page}&sort=${sort}`),
    get('/api/proxy/deskhub/versions?limit=200'),
  ]);

  // 构建 slug → 最新版本映射
  const versionMap = {};
  for (const v of versionsRes.data) {
    if (!versionMap[v.slug]) versionMap[v.slug] = v; // 按 publishedAt 降序，第一条即最新
  }

  const items = skillsRes.data.items.map(item => transformSkill(item, versionMap));

  return {
    items,
    total: skillsRes.data.total,
    page: skillsRes.data.page,
    totalPages: skillsRes.data.totalPages,
    meta: skillsRes.meta,
  };
}

/**
 * 获取单个技能详情（含版本历史）
 */
export async function getSkillDetail(slug) {
  if (!USE_API) return SKILLS.find(s => s.slug === slug) || null;

  const res = await get(`/api/proxy/deskhub/skills/${encodeURIComponent(slug)}`);
  return res.data;
}

/**
 * 获取最近版本变更流
 */
export async function getRecentVersions({ since, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (since) params.set('since', since);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();

  const res = await get(`/api/proxy/deskhub/versions${qs ? '?' + qs : ''}`);
  return res.data;
}
