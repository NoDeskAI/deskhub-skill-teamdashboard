import { get } from './api.js';
import { MCPS } from '../constants/mock-data.js';

const USE_API = import.meta.env.VITE_USE_API !== 'false';

/**
 * 获取 MCP 工具列表 + 健康状态 + 版本信息
 * 真实 API 提供：工具名/描述/版本/健康状态
 * 无 API 的字段（calls/successRate/callTrend/dependSkills）→ null
 */
export async function getMCPData() {
  const [toolsRes, infoRes, healthRes] = await Promise.allSettled([
    get('/api/proxy/mcp/tools'),
    get('/api/proxy/mcp/info'),
    get('/api/proxy/mcp/health'),
  ]);

  const tools = toolsRes.status === 'fulfilled' && toolsRes.value?.data ? toolsRes.value.data : null;
  const info = infoRes.status === 'fulfilled' && infoRes.value?.data ? infoRes.value.data : null;
  const health = healthRes.status === 'fulfilled' && healthRes.value?.data ? healthRes.value.data : null;

  // API 不可达
  if (!tools) {
    if (!USE_API) return { mcps: MCPS, info: null, health: null, isReal: false };
    throw new Error('MCP API 不可达');
  }

  // 转换工具列表为前端 MCP 格式
  const mcps = tools.map((t, i) => ({
    id: `mcp-${i}`,
    name: t.name,
    slug: t.name,
    status: health?.status === 'ok' ? 'stable' : 'planned',
    ver: info?.version || '—',
    desc: t.desc || '',
    fullDesc: t.fullDesc || '',
    updated: '—',
    maintainer: null,                // 无 API
    calls: null,                     // 无 API
    successRate: null,               // 无 API
    avgResponseTime: null,           // 无 API
    callTrend: null,                 // 无 API
    dependSkills: [],                // 无 API
    params: t.params || [],          // 真实：工具参数列表
  }));

  return {
    mcps,
    info,
    health,
    isReal: true,
  };
}
