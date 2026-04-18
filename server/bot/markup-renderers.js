/**
 * Markup → CardKit 元素渲染器
 *
 * 每种 markup 对应一个 renderer。返回结构：
 *   inline：{ placement: 'inline', text: string }  // 将拼到当前 main_text 段
 *   block：{ placement: 'block', elementId: string, elements: object[] }  // 独立插入
 *
 * 所有 renderer 都是 async；渲染失败/数据缺失时退化成 text/placeholder 不抛错。
 *
 * 数据源：
 *   - getPlanDetail / getUserByUsername → server/mcp/db-ops.js（同步 SQLite，快）
 *   - getDeskhubSkill → server/mcp/proxy-ops.js HTTP + 缓存
 *   - getMcpToolByName → 同上，走 listDeskclawTools 的 30min 缓存
 */

import { getPlanDetail, getUserByUsername } from '../mcp/db-ops.js';
import { getDeskhubSkill, getMcpToolByName } from '../mcp/proxy-ops.js';
import { PLAN_ST, PLAN_PHASE, PLAN_RESULT } from '../../shared/constants/status.js';
import { PRI } from '../../shared/constants/priority.js';

// ── 色彩枚举映射（shared 常量的 hex → Feishu enum） ──
// CardKit 的 text_tag/background_style 只接受枚举名，不接受 hex
const PLAN_STATUS_COLOR = { next: 'green', active: 'orange', done: 'grey' };
const PLAN_PHASE_COLOR  = { collecting: 'yellow', evaluating: 'carmine', finalizing: 'green' };
const PLAN_RESULT_COLOR = { adopted: 'green', shelved: 'grey' };
const PRI_COLOR = { high: 'red', medium: 'yellow', low: 'green' };
const CALLOUT_BG = { info: 'blue-50', success: 'green-50', warn: 'orange-50', error: 'red-50' };
const CALLOUT_TAG = { info: 'blue', success: 'green', warn: 'orange', error: 'red' };

// 由 streamer 注入的递增 counter，保证 element_id 唯一
function blockId(prefix, counter) {
  return `markup_${prefix}_${counter}`;
}

// ─────────────────────────────────────────────
//  inline 渲染
// ─────────────────────────────────────────────

async function renderUser(name) {
  const u = getUserByUsername(name);
  if (u && u.feishuOpenId) {
    return { placement: 'inline', text: `<person id='${u.feishuOpenId}'>${u.displayName}</person>` };
  }
  const fallback = u ? u.displayName : name;
  return { placement: 'inline', text: `**${fallback}**` };
}

async function renderLink(url, label) {
  const safeLabel = label || url;
  const safeUrl = url || '#';
  return { placement: 'inline', text: `[${safeLabel}](${safeUrl})` };
}

// ─────────────────────────────────────────────
//  block 渲染
// ─────────────────────────────────────────────

async function renderPlan(id, counter) {
  if (!id) {
    return blockFallback('block_plan', counter, `（plan markup 缺 ID）`);
  }
  const plan = getPlanDetail(id);
  if (!plan) {
    return blockFallback('block_plan', counter, `（工单 ${id} 不存在）`);
  }

  // 状态 tag（PLAN_ST.l + 枚举色）
  const stMeta = PLAN_ST[plan.status] || {};
  const stColor = PLAN_STATUS_COLOR[plan.status] || 'grey';
  const stTag = `<text_tag color='${stColor}'>${stMeta.l || plan.status}</text_tag>`;

  // 优先级 tag（PRI.l + 枚举色）
  const priMeta = PRI[plan.priority] || {};
  const priColor = PRI_COLOR[plan.priority] || 'grey';
  const priTag = plan.priority ? `<text_tag color='${priColor}'>${priMeta.l || plan.priority}</text_tag>` : '';

  // 子阶段（只 active 态才有意义）
  let phaseTag = '';
  if (plan.status === 'active') {
    // 自动推断 phase：简化版本，如果有 variants 数组判断；当前先按状态兜底
    const variantCount = Array.isArray(plan.variants) ? plan.variants.length : 0;
    let phase = 'collecting';
    if (variantCount > 0) phase = 'evaluating';
    const phMeta = PLAN_PHASE[phase];
    phaseTag = `<text_tag color='${PLAN_PHASE_COLOR[phase]}'>${phMeta.l}</text_tag>`;
  } else if (plan.status === 'done' && plan.result) {
    const rMeta = PLAN_RESULT[plan.result];
    if (rMeta) {
      phaseTag = `<text_tag color='${PLAN_RESULT_COLOR[plan.result]}'>${rMeta.l}</text_tag>`;
    }
  }

  // 方案数 / 均分
  const variants = Array.isArray(plan.variants) ? plan.variants : [];
  const allScores = variants.flatMap(v => Array.isArray(v.scores) ? v.scores : []);
  const avgScore = allScores.length
    ? (allScores.reduce((s, x) => s + (x.value || 0), 0) / allScores.length).toFixed(1)
    : null;
  const metaParts = [];
  if (variants.length) metaParts.push(`方案 ${variants.length} 个`);
  if (avgScore !== null) metaParts.push(`均分 ${avgScore}`);
  if (plan.owner) metaParts.push(`负责人 ${plan.owner}`);
  const metaLine = metaParts.length ? `<font color='grey'>${metaParts.join(' · ')}</font>` : '';

  const title = `**${plan.id} · ${plan.name || '未命名工单'}**`;
  const tagLine = [priTag, stTag, phaseTag].filter(Boolean).join(' ');
  const content = [title + (tagLine ? ' ' + tagLine : ''), metaLine].filter(Boolean).join('\n\n');

  const elementId = blockId('plan', counter);
  return {
    placement: 'block',
    elementId,
    elements: [{
      tag: 'interactive_container',
      element_id: elementId,
      padding: '12px 14px',
      margin: '8px 0',
      has_border: true,
      border_color: 'grey',
      corner_radius: '10px',
      background_style: 'default',
      elements: [{ tag: 'markdown', content }],
    }],
  };
}

async function renderSkill(slug, counter) {
  if (!slug) return blockFallback('block_skill', counter, '（skill markup 缺 slug）');
  let skill = null;
  try {
    skill = await getDeskhubSkill(slug);
  } catch (err) {
    console.warn('[Bot/Markup] getDeskhubSkill 失败:', err.message);
  }
  if (!skill) return blockFallback('block_skill', counter, `（技能 ${slug} 未找到）`);

  const name = skill.displayName || skill.name || slug;
  const summary = skill.summary || skill.description || '';
  const elementId = blockId('skill', counter);
  return {
    placement: 'block',
    elementId,
    elements: [{
      tag: 'interactive_container',
      element_id: elementId,
      padding: '12px 14px',
      margin: '8px 0',
      has_border: true,
      border_color: 'grey',
      corner_radius: '10px',
      background_style: 'default',
      elements: [{
        tag: 'markdown',
        content: `**${name}** <text_tag color='wathet'>DeskHub 技能</text_tag>${summary ? `\n\n<font color='grey'>${summary}</font>` : ''}`,
      }],
    }],
  };
}

async function renderMcp(name, counter) {
  if (!name) return blockFallback('block_mcp', counter, '（mcp markup 缺 name）');
  let tool = null;
  try {
    tool = await getMcpToolByName(name);
  } catch (err) {
    console.warn('[Bot/Markup] getMcpToolByName 失败:', err.message);
  }
  if (!tool) return blockFallback('block_mcp', counter, `（MCP 工具 ${name} 未找到）`);

  const elementId = blockId('mcp', counter);
  return {
    placement: 'block',
    elementId,
    elements: [{
      tag: 'interactive_container',
      element_id: elementId,
      padding: '12px 14px',
      margin: '8px 0',
      has_border: true,
      border_color: 'grey',
      corner_radius: '10px',
      background_style: 'default',
      elements: [{
        tag: 'markdown',
        content: `**${tool.name}** <text_tag color='indigo'>MCP 工具</text_tag>${tool.desc ? `\n\n<font color='grey'>${tool.desc}</font>` : ''}`,
      }],
    }],
  };
}

async function renderCallout(level, text, counter) {
  const lv = (level || 'info').toLowerCase();
  const bg = CALLOUT_BG[lv] || 'blue-50';
  const tagColor = CALLOUT_TAG[lv] || 'blue';
  const labelMap = { info: '提示', success: '成功', warn: '注意', error: '错误' };
  const label = labelMap[lv] || '提示';
  const body = text || '';
  const elementId = blockId('callout', counter);
  return {
    placement: 'block',
    elementId,
    elements: [{
      tag: 'interactive_container',
      element_id: elementId,
      padding: '10px 14px',
      margin: '8px 0',
      corner_radius: '8px',
      background_style: bg,
      elements: [{
        tag: 'markdown',
        content: `<text_tag color='${tagColor}'>${label}</text_tag> ${body}`,
      }],
    }],
  };
}

async function renderSection(title, counter) {
  const elementId = blockId('section', counter);
  return {
    placement: 'block',
    elementId,
    elements: [{
      tag: 'markdown',
      element_id: elementId,
      content: `**${title || ''}**`,
      text_size: 'heading-4',
    }],
  };
}

async function renderDivider(counter) {
  const elementId = blockId('divider', counter);
  return {
    placement: 'block',
    elementId,
    elements: [{ tag: 'hr', element_id: elementId, margin: '8px 0' }],
  };
}

// 统一的降级（数据缺失/ID 错）
function blockFallback(prefix, counter, text) {
  const elementId = blockId(prefix, counter);
  return {
    placement: 'block',
    elementId,
    elements: [{
      tag: 'markdown',
      element_id: elementId,
      content: `<font color='grey'>${text}</font>`,
      text_size: 'notation',
    }],
  };
}

// ─────────────────────────────────────────────
//  入口分发
// ─────────────────────────────────────────────

/**
 * @param {string} tag
 * @param {string[]} args
 * @param {number} counter - 由 streamer 递增，保证 element_id 唯一
 * @returns {Promise<null | { placement: 'inline', text: string } | { placement: 'block', elementId: string, elements: object[] }>}
 */
export async function renderMarkup(tag, args, counter) {
  try {
    switch (tag) {
      case 'user':    return await renderUser(args[0]);
      case 'link':    return await renderLink(args[0], args[1]);
      case 'plan':    return await renderPlan(args[0], counter);
      case 'skill':   return await renderSkill(args[0], counter);
      case 'mcp':     return await renderMcp(args[0], counter);
      case 'callout': return await renderCallout(args[0], args[1], counter);
      case 'section': return await renderSection(args[0], counter);
      case 'divider': return await renderDivider(counter);
      case 'header':  return null;   // Stage C 在上游直接消费，这里忽略
      default:        return null;
    }
  } catch (err) {
    console.error(`[Bot/Markup] renderMarkup(${tag}) 失败:`, err.message);
    return blockFallback('fallback', counter, `（渲染 ${tag} 失败）`);
  }
}
