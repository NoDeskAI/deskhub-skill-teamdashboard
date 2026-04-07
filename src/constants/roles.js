import { Shield, FlaskConical, Eye } from "lucide-react";

export const ROLES = [
  { id: "admin", label: "管理员", desc: "需求规划 · 维度定义 · 方案选定", Icon: Shield, color: "#8a6a3a", bg: "rgba(138,106,58,0.12)" },
  { id: "tester", label: "测试员", desc: "方案评测 · 评分提交", Icon: FlaskConical, color: "#5a7a9a", bg: "rgba(90,122,154,0.12)" },
  { id: "member", label: "团队成员", desc: "浏览查看 · 提交方案", Icon: Eye, color: "#6a8a6a", bg: "rgba(106,138,106,0.12)" },
];
