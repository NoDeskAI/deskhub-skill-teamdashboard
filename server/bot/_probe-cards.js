/**
 * 飞书 CardKit icon / color 探测卡
 *
 * 用途：在 Feishu 里发 `/probe` 命令触发，把候选 icon token 和 color 值
 * 逐行打在卡片 body 里。渲染失败的 icon 会退成灰色默认占位，我们能肉眼
 * 区分哪些 token 有效、哪些 color 能让 icon 上色。
 *
 * 不用于生产路径；仅 handleMessage 识别到 `/probe` 时发一次。
 */

// ── 候选 icon token（按类别组织）──
const ICON_CANDIDATES = [
  // AI / 魔法（场景 header 候选）
  'myai-magic-wand_outlined',
  'myai-sparkles_outlined',
  'myai-brain_outlined',
  'myai-chat_outlined',
  // 思考 / 灯泡
  'idea_outlined',
  'light-bulb_outlined',
  'brain_outlined',
  // 数据 / 图表
  'chart-ring_outlined',
  'chart_outlined',
  'bar-chart_outlined',
  'bitablegrid_outlined',
  'bitablekanban_outlined',
  // 编辑 / 文档
  'edit_outlined',
  'pen_outlined',
  'pencil_outlined',
  'file-doc_outlined',
  'file-link-docx_outlined',
  // 对钩 / 完成
  'done_outlined',
  'done-circle_outlined',
  'check_outlined',
  'check-bold_outlined',
  'yes_outlined',
  // 关闭 / 错误
  'close_outlined',
  'close-circle_outlined',
  'close-bold_outlined',
  'no_outlined',
  // 加号 / 减号（折叠条候选）
  'add_outlined',
  'plus_outlined',
  'plus-bold_outlined',
  'reduce_outlined',
  'minus_outlined',
  // 铃 / 提醒
  'bell_outlined',
  'bell-ring_outlined',
  'bell-filled_outlined',
  // 信息 / 警告
  'info_outlined',
  'warning_outlined',
  'warning-triangle_outlined',
  // 搜索 / 其他
  'search_outlined',
  'chat_outlined',
  'calendar_outlined',
];

// ── 候选 color（覆盖 v2 枚举 + 一个可能无效的 neutral 做 sanity check）──
const COLOR_CANDIDATES = [
  'orange', 'red', 'green', 'blue',
  'indigo', 'violet', 'turquoise', 'yellow',
  'purple', 'carmine', 'grey', 'wathet',
  'lime', 'sunflower',
  'neutral',   // 文档里没有，用来验证"无效 color 是否回退"
];

export function buildIconProbeCard() {
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: {
      title: { tag: 'plain_text', content: '🔬 Icon Token 探测' },
      subtitle: { tag: 'plain_text', content: `${ICON_CANDIDATES.length} 个候选 · 彩色 = 有效 / 灰 = 退回` },
      icon: { tag: 'standard_icon', token: 'search_outlined', color: 'indigo' },
      template: 'default',
    },
    body: {
      elements: ICON_CANDIDATES.map(token => ({
        tag: 'div',
        text: { tag: 'plain_text', content: token, text_size: 'notation' },
        icon: { tag: 'standard_icon', token, color: 'orange' },
      })),
    },
  };
}

export function buildColorProbeCard() {
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: {
      title: { tag: 'plain_text', content: '🎨 Icon Color 探测' },
      subtitle: { tag: 'plain_text', content: `${COLOR_CANDIDATES.length} 个色值 · 基于 done_outlined` },
      icon: { tag: 'standard_icon', token: 'info_outlined', color: 'indigo' },
      template: 'default',
    },
    body: {
      elements: COLOR_CANDIDATES.map(color => ({
        tag: 'div',
        text: { tag: 'plain_text', content: color, text_size: 'notation' },
        icon: { tag: 'standard_icon', token: 'done_outlined', color },
      })),
    },
  };
}

export function buildHeaderTemplateProbeCard(template) {
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: {
      title: { tag: 'plain_text', content: `template = ${template}` },
      subtitle: { tag: 'plain_text', content: '这就是该 template 的 header 底色' },
      icon: { tag: 'standard_icon', token: 'done_outlined', color: 'grey' },
      template,
    },
    body: {
      elements: [
        { tag: 'markdown', content: `如果这张卡 header 是 ${template} 色调，说明 \`${template}\` 这个 template 生效。` },
      ],
    },
  };
}

export const HEADER_TEMPLATES = [
  'default', 'blue', 'wathet', 'turquoise', 'green', 'yellow',
  'orange', 'red', 'carmine', 'violet', 'purple', 'indigo', 'grey',
];
