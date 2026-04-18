import { Flame, FlaskConical, ScrollText, BadgeCheck, Inbox, ClipboardCheck, Archive } from "lucide-react";
import {
  ST as _ST,
  MCP_ST as _MCP_ST,
  PLAN_ST as _PLAN_ST,
  PLAN_PHASE as _PLAN_PHASE,
  PLAN_RESULT as _PLAN_RESULT,
} from "../../shared/constants/status.js";

// 前端 wrapper：纯数据从 shared/ 来，lucide Icon 在此处注入
// 后端 server/bot 直接 import shared/ 的裸数据，不沾 lucide

// 技能状态（Dashboard 用）
export const ST = {
  iterating: { ..._ST.iterating, Icon: Flame },
  testing:   { ..._ST.testing,   Icon: FlaskConical },
  planned:   { ..._ST.planned,   Icon: ScrollText },
  stable:    { ..._ST.stable,    Icon: BadgeCheck },
};

// MCP 工具状态（MCP 速查用）
export const MCP_ST = {
  stable:    { ..._MCP_ST.stable,    Icon: BadgeCheck },
  iterating: { ..._MCP_ST.iterating, Icon: Flame },
  planned:   { ..._MCP_ST.planned,   Icon: ScrollText },
};

// 工单生命周期状态（手动流转）
export const PLAN_ST = {
  next:   { ..._PLAN_ST.next,   Icon: ScrollText },
  active: { ..._PLAN_ST.active, Icon: Flame },
  done:   { ..._PLAN_ST.done,   Icon: BadgeCheck },
};

// 进行中的子阶段（系统自动推断，不存储）
export const PLAN_PHASE = {
  collecting: { ..._PLAN_PHASE.collecting, Icon: Inbox },
  evaluating: { ..._PLAN_PHASE.evaluating, Icon: FlaskConical },
  finalizing: { ..._PLAN_PHASE.finalizing, Icon: ClipboardCheck },
};

// 已完成的结果标记
export const PLAN_RESULT = {
  adopted: { ..._PLAN_RESULT.adopted, Icon: BadgeCheck },
  shelved: { ..._PLAN_RESULT.shelved, Icon: Archive },
};
