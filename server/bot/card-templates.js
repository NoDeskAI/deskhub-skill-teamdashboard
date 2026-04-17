/**
 * 飞书卡片模板（Card JSON 2.0）
 *
 * 五大场景：
 *   1. 聊天（流式 + 折叠思考链 + 折叠工具进度 + 主答案）
 *   2. 群聊变更通知
 *   3. 私聊提醒
 *   4. 每日巡检
 *   5. 简单回复（绑定/背压/错误，按 level 区分图标和颜色）
 *
 * 配色：飞书 enum（orange/green/red/grey/indigo），自动适配深浅模式
 * 图标：全 _outlined 线性
 * Header：默认 template=default，仅高优/错误场景上色
 */

const BOT_NAME = '小合';

// ============================================================
//  配置常量
// ============================================================

/** 流式更新节奏（ms） */
const STREAMING_CONFIG = {
  print_frequency_ms: { default: 30, pc: 30, ios: 30, android: 30 },
  print_step: { default: 2 },
  print_strategy: 'fast',
};

/** 工具名称展示映射 */
const TOOL_LABELS = {
  list_plans: '查询工单列表',
  get_plan_detail: '查询工单详情',
  get_dimensions: '查询评分维度',
  list_deskhub_skills: '查询 DeskHub 技能',
  get_deskhub_skill: '查询技能详情',
  get_umami_stats: '查询访问统计',
  get_umami_active: '查询在线人数',
  list_users: '查询团队成员',
  get_recent_changes: '查询最近变更',
  send_notification: '发送私聊提醒',
};

/** 变更通知用 emoji */
const ACTION_EMOJI = {
  created: '🆕',
  updated: '📝',
  status_changed: '🔄',
  deleted: '🗑️',
};

// ============================================================
//  通用工具
// ============================================================

function timeStr(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function dateStr(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// ============================================================
//  ① 聊天卡片（流式核心）
// ============================================================

/**
 * 聊天卡片初始 JSON
 * 仅含一个空的 main_text 元素，thinking_panel / tool_panel 在运行时动态插入
 */
export function buildChatCardInitial() {
  return {
    schema: '2.0',
    config: {
      streaming_mode: true,
      streaming_config: STREAMING_CONFIG,
      summary: { content: `${BOT_NAME}正在思考...` },
      update_multi: true,
      width_mode: 'fill',
    },
    header: {
      title: { tag: 'plain_text', content: BOT_NAME },
      subtitle: { tag: 'plain_text', content: 'DeskHub 助手' },
      icon: { tag: 'standard_icon', token: 'myai-magic-wand_outlined', color: 'orange' },
      template: 'default',
    },
    body: {
      elements: [
        { tag: 'markdown', element_id: 'main_text', content: '' },
      ],
    },
  };
}

/**
 * 思考面板（折叠面板 + 内嵌 markdown）
 * 第一次 thinking_chunk 到达时插入到 main_text 之前
 */
export function buildThinkingPanel() {
  return [
    {
      tag: 'collapsible_panel',
      element_id: 'thinking_panel',
      expanded: true,
      background_color: 'grey-50',
      padding: '8px 12px',
      margin: '0 0 8px 0',
      header: {
        title: { tag: 'plain_text', content: '💭 思考中…' },
        vertical_align: 'center',
        padding: '4px 8px 4px 8px',
        icon: { tag: 'standard_icon', token: 'down-small-ccm_outlined', size: '14px 14px' },
        icon_position: 'right',
        icon_expanded_angle: -180,
      },
      elements: [
        {
          tag: 'markdown',
          element_id: 'thinking_text',
          content: '',
          text_size: 'notation',
        },
      ],
    },
  ];
}

/** 思考完成时收起折叠面板 + 改标题 */
export const THINKING_PANEL_DONE_PATCH = {
  expanded: false,
  header: {
    title: { tag: 'plain_text', content: '💭 思考过程' },
    vertical_align: 'center',
    padding: '4px 8px 4px 8px',
    icon: { tag: 'standard_icon', token: 'down-small-ccm_outlined', size: '14px 14px' },
    icon_position: 'right',
    icon_expanded_angle: -180,
  },
};

/**
 * 工具面板（折叠面板 + 内嵌进度 markdown）
 * 第一次 tool_start 时插入到 main_text 之前
 */
export function buildToolPanel() {
  return [
    {
      tag: 'collapsible_panel',
      element_id: 'tool_panel',
      expanded: true,
      background_color: 'grey-50',
      padding: '8px 12px',
      margin: '0 0 8px 0',
      header: {
        title: { tag: 'plain_text', content: '🔧 工具执行中…' },
        vertical_align: 'center',
        padding: '4px 8px 4px 8px',
        icon: { tag: 'standard_icon', token: 'down-small-ccm_outlined', size: '14px 14px' },
        icon_position: 'right',
        icon_expanded_angle: -180,
      },
      elements: [
        {
          tag: 'markdown',
          element_id: 'tool_progress',
          content: '',
        },
      ],
    },
  ];
}

/**
 * 工具完成时收起折叠面板 + 改标题（"已使用 N 个工具"）
 */
export function buildToolPanelDonePatch(toolCount) {
  return {
    expanded: false,
    header: {
      title: { tag: 'plain_text', content: `🔧 已使用 ${toolCount} 个工具` },
      vertical_align: 'center',
      padding: '4px 8px 4px 8px',
      icon: { tag: 'standard_icon', token: 'down-small-ccm_outlined', size: '14px 14px' },
      icon_position: 'right',
      icon_expanded_angle: -180,
    },
  };
}

/**
 * 把工具步骤数组渲染成 markdown 文本
 * @param {Array<{name:string, done:boolean}>} steps
 */
export function buildToolProgressMarkdown(steps) {
  if (!steps || steps.length === 0) return '';
  return steps
    .map(s => {
      const label = TOOL_LABELS[s.name] || s.name;
      return s.done ? `✅  ${label}` : `⏳  ${label}…`;
    })
    .join('\n');
}

// ============================================================
//  ② 群聊变更通知
// ============================================================

/**
 * @param {string} message - LLM 整理的中文叙述（允许含表格）
 * @param {object} opts
 * @param {number} opts.changeCount
 * @param {Array<{action,priority,summary}>} [opts.changes] - 用于生成顶部标签
 */
export function buildNotificationCard(message, { changeCount = 0, changes = [] } = {}) {
  const highCount = changes.filter(c => c.priority === 'high').length;
  const medCount = changes.filter(c => c.priority === 'medium').length;

  const tagList = [];
  if (highCount > 0) tagList.push({ tag: 'text_tag', text: { tag: 'plain_text', content: `${highCount} 项高优` }, color: 'red' });
  if (medCount > 0) tagList.push({ tag: 'text_tag', text: { tag: 'plain_text', content: `${medCount} 项中优` }, color: 'orange' });
  tagList.push({ tag: 'text_tag', text: { tag: 'plain_text', content: 'AI 整理' }, color: 'neutral' });

  const isHighPriority = highCount > 0;

  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: {
      title: { tag: 'plain_text', content: `工作台 · ${changeCount} 项变更` },
      subtitle: { tag: 'plain_text', content: timeStr() },
      text_tag_list: tagList.slice(0, 3),
      icon: {
        tag: 'standard_icon',
        token: 'bell_outlined',
        color: isHighPriority ? 'red' : 'grey',
      },
      template: isHighPriority ? 'red' : 'default',
    },
    body: {
      elements: [
        { tag: 'markdown', element_id: 'notify_body', content: message || '（无内容）' },
        { tag: 'hr' },
        {
          tag: 'markdown',
          content: `<font color='grey'>小合整理 · ${timeStr()}</font>`,
          text_size: 'notation',
        },
      ],
    },
  };
}

// ============================================================
//  ③ 私聊提醒（send_notification 工具发的）
// ============================================================

/**
 * @param {string} message
 * @param {object} [opts]
 * @param {string} [opts.from] - "来自 小合" / "来自 admin"
 */
export function buildPersonalCard(message, { from = '小合' } = {}) {
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: {
      title: { tag: 'plain_text', content: 'DeskHub 提醒' },
      subtitle: { tag: 'plain_text', content: `来自 ${from}` },
      icon: { tag: 'standard_icon', token: 'bell-ring_outlined', color: 'orange' },
      template: 'default',
    },
    body: {
      elements: [
        { tag: 'markdown', element_id: 'personal_body', content: message || '（无内容）' },
      ],
    },
  };
}

// ============================================================
//  ④ 每日巡检
// ============================================================

/**
 * @param {string} message - LLM 整理的巡检结果（允许含表格、人员标签等）
 * @param {object} [opts]
 * @param {number} [opts.attentionCount] - "N 项关注" 标签
 */
export function buildPatrolCard(message, { attentionCount = 0 } = {}) {
  const tagList = [];
  if (attentionCount > 0) {
    tagList.push({
      tag: 'text_tag',
      text: { tag: 'plain_text', content: `${attentionCount} 项关注` },
      color: 'indigo',
    });
  }

  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: {
      title: { tag: 'plain_text', content: '每日巡检' },
      subtitle: { tag: 'plain_text', content: dateStr() },
      text_tag_list: tagList,
      icon: { tag: 'standard_icon', token: 'chart-ring_outlined', color: 'indigo' },
      template: 'default',
    },
    body: {
      elements: [
        { tag: 'markdown', element_id: 'patrol_body', content: message || '（无内容）' },
        { tag: 'hr' },
        {
          tag: 'markdown',
          content: `<font color='grey'>小合每日巡检 · ${timeStr()}</font>`,
          text_size: 'notation',
        },
      ],
    },
  };
}

// ============================================================
//  ⑤ 简单回复（绑定/背压/错误，按 level 区分）
// ============================================================

const SIMPLE_LEVEL_CONFIG = {
  info:    { token: 'info_outlined',           color: 'grey',   template: 'default' },
  success: { token: 'done_outlined',           color: 'green',  template: 'default' },
  warn:    { token: 'warning-triangle_outlined', color: 'orange', template: 'default' },
  error:   { token: 'close-circle_outlined',   color: 'red',    template: 'red' },
};

/**
 * @param {string} content
 * @param {object} [opts]
 * @param {'info'|'success'|'warn'|'error'} [opts.level='info']
 * @param {string} [opts.title='小合']
 * @param {string} [opts.subtitle]
 */
export function buildSimpleCard(content, { level = 'info', title = BOT_NAME, subtitle } = {}) {
  const cfg = SIMPLE_LEVEL_CONFIG[level] || SIMPLE_LEVEL_CONFIG.info;

  const header = {
    title: { tag: 'plain_text', content: title },
    icon: { tag: 'standard_icon', token: cfg.token, color: cfg.color },
    template: cfg.template,
  };
  if (subtitle) header.subtitle = { tag: 'plain_text', content: subtitle };

  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header,
    body: {
      elements: [
        { tag: 'markdown', element_id: 'reply_body', content: content || '（无内容）' },
      ],
    },
  };
}

// ============================================================
//  导出常量给调用方
// ============================================================

export { TOOL_LABELS, ACTION_EMOJI };
