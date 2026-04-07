import { Flame, FlaskConical, ScrollText, BadgeCheck, Inbox, ClipboardCheck, Archive } from "lucide-react";

// 技能状态（Dashboard 用）
export const ST = {
  iterating: { l: "迭代中", c: "#b85c1a", tagBg: "#e8a84a", Icon: Flame },
  testing:   { l: "测试中", c: "#8a3a3a", tagBg: "#d4845a", Icon: FlaskConical },
  planned:   { l: "规划中", c: "#3a6a3a", tagBg: "#7aba7a", Icon: ScrollText },
  stable:    { l: "已完成", c: "#5a4a30", tagBg: "#c4a882", Icon: BadgeCheck },
};

// MCP 工具状态（MCP 速查用）
export const MCP_ST = {
  stable:    { l: "已就绪", c: "#5a4a30", tagBg: "#c4a882", Icon: BadgeCheck },
  iterating: { l: "迭代中", c: "#b85c1a", tagBg: "#e8a84a", Icon: Flame },
  planned:   { l: "规划中", c: "#3a6a3a", tagBg: "#7aba7a", Icon: ScrollText },
};

// 工单生命周期状态（手动流转）
export const PLAN_ST = {
  next:   { l: "下期规划", c: "#3a6a3a", tagBg: "#7aba7a", Icon: ScrollText },
  active: { l: "进行中",  c: "#b85c1a", tagBg: "#e8a84a", Icon: Flame },
  done:   { l: "已完成",  c: "#5a4a30", tagBg: "#c4a882", Icon: BadgeCheck },
};

// 进行中的子阶段（系统自动推断，不存储）
export const PLAN_PHASE = {
  collecting: { l: "征集方案", c: "#b8861a", tagBg: "#e8c86a", Icon: Inbox },
  evaluating: { l: "评测中",  c: "#8a3a3a", tagBg: "#d4845a", Icon: FlaskConical },
  finalizing: { l: "待定稿",  c: "#3a6a3a", tagBg: "#7aba7a", Icon: ClipboardCheck },
};

// 已完成的结果标记
export const PLAN_RESULT = {
  adopted: { l: "已采纳", c: "#4a8a4a", tagBg: "#a0d4a0", Icon: BadgeCheck },
  shelved: { l: "已搁置", c: "#8a8580", tagBg: "#c4c0b8", Icon: Archive },
};
