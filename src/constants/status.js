import { Flame, FlaskConical, ScrollText, BadgeCheck } from "lucide-react";

export const ST = {
  iterating: { l: "迭代中", c: "#b85c1a", tagBg: "#e8a84a", Icon: Flame },
  testing:   { l: "测试中", c: "#8a3a3a", tagBg: "#d4845a", Icon: FlaskConical },
  planned:   { l: "规划中", c: "#3a6a3a", tagBg: "#7aba7a", Icon: ScrollText },
  stable:    { l: "已完成", c: "#5a4a30", tagBg: "#c4a882", Icon: BadgeCheck },
};

export const MCP_ST = {
  stable:    { l: "已就绪", c: "#5a4a30", tagBg: "#c4a882", Icon: BadgeCheck },
  iterating: { l: "迭代中", c: "#b85c1a", tagBg: "#e8a84a", Icon: Flame },
  planned:   { l: "规划中", c: "#3a6a3a", tagBg: "#7aba7a", Icon: ScrollText },
};

export const MR_ST = {
  reviewing: { l: "审核中", c: "#b8861a" },
  accepted:  { l: "已采纳", c: "#4a8a4a" },
  rejected:  { l: "已搁置", c: "#8a8580" },
};
