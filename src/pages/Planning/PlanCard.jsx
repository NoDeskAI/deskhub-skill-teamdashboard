import { CheckCircle2 } from "lucide-react";
import { PRI } from "../../constants/priority.js";
import { FONT_MONO, FONT_SANS } from "../../constants/theme.js";
import BaseCard from "../../components/cards/BaseCard.jsx";

export default function PlanCard({ plan, style, hovered, onHover, onLeave, onClick, absolute = true }) {
  const pri = PRI[plan.priority]; const vC = plan.variants.length; const tested = plan.variants.filter(v => v.tested).length;
  return (
    <BaseCard style={style} hovered={hovered} onHover={onHover} onLeave={onLeave} onClick={onClick} absolute={absolute}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#3a2a18", lineHeight: 1.6, marginBottom: 5, minHeight: 26 }}>{plan.name}</div>
      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
        <span style={{ padding: "1px 4px", background: pri.bg, borderRadius: 4, fontFamily: FONT_SANS, fontSize: 12, color: pri.c }}>{pri.l}</span>
        {plan.selected && <span style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#4a8a4a" }}><CheckCircle2 size={11} style={{ verticalAlign: "middle", marginRight: 2 }} />已定</span>}
      </div>
      <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#4a4540", lineHeight: 1.4, marginBottom: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{plan.desc}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_SANS, fontSize: 12 }}>
        <span style={{ color: "#8a7a58" }}>方案 {vC}</span>
        <span style={{ color: tested > 0 ? "#6a8a4a" : "#a89a78" }}>已测 {tested}/{vC}</span>
      </div>
      <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#a89a78", marginTop: 3, textAlign: "right" }}>{plan.created}</div>
    </BaseCard>
  );
}
