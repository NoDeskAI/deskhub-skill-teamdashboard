/**
 * 状态常量（纯数据层）— 前后端共用
 *
 * 前端 src/constants/status.js 在此基础上 merge lucide Icon 字段；
 * 后端 server/bot 直接用纯数据（l / c / tagBg）给 CardKit 上色/打标签。
 *
 * 颜色值对齐 TeamBoard 暖色系，和 src/constants/theme.js 同源。
 */

// 技能状态（Dashboard 用）
export const ST = {
  iterating: { l: "迭代中", c: "#b85c1a", tagBg: "#e8a84a" },
  testing:   { l: "测试中", c: "#8a3a3a", tagBg: "#d4845a" },
  planned:   { l: "规划中", c: "#3a6a3a", tagBg: "#7aba7a" },
  stable:    { l: "已完成", c: "#5a4a30", tagBg: "#c4a882" },
};

// MCP 工具状态（MCP 速查用）
export const MCP_ST = {
  stable:    { l: "已就绪", c: "#5a4a30", tagBg: "#c4a882" },
  iterating: { l: "迭代中", c: "#b85c1a", tagBg: "#e8a84a" },
  planned:   { l: "规划中", c: "#3a6a3a", tagBg: "#7aba7a" },
};

// 工单生命周期状态（手动流转）
export const PLAN_ST = {
  next:   { l: "下期规划", c: "#3a6a3a", tagBg: "#7aba7a" },
  active: { l: "进行中",  c: "#b85c1a", tagBg: "#e8a84a" },
  done:   { l: "已完成",  c: "#5a4a30", tagBg: "#c4a882" },
};

// 进行中的子阶段（系统自动推断，不存储）
export const PLAN_PHASE = {
  collecting: { l: "征集方案", c: "#b8861a", tagBg: "#e8c86a" },
  evaluating: { l: "评测中",  c: "#8a3a3a", tagBg: "#d4845a" },
  finalizing: { l: "待定稿",  c: "#3a6a3a", tagBg: "#7aba7a" },
};

// 已完成的结果标记
export const PLAN_RESULT = {
  adopted: { l: "已采纳", c: "#4a8a4a", tagBg: "#a0d4a0" },
  shelved: { l: "已搁置", c: "#8a8580", tagBg: "#c4c0b8" },
};
