import { ST } from "../../constants/status.js";
import { FONT_MONO } from "../../constants/theme.js";
import { SIcon } from "../../components/ui/Icons.jsx";
import BaseCard from "../../components/cards/BaseCard.jsx";

export default function SkillCard({ sk, style, hovered, onHover, onLeave, onClick, absolute = true }) {
  const s = ST[sk.status]; const pct = Math.round(sk.iters / 25 * 100);
  return (
    <BaseCard style={style} hovered={hovered} onHover={onHover} onLeave={onLeave} onClick={onClick} absolute={absolute}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#2d2418", lineHeight: 1.7, marginBottom: 6, letterSpacing: 0.3 }}>{sk.name}</div>
      <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ padding: "2px 6px", background: s.tagBg + "25", borderRadius: 5, fontSize: 11, fontWeight: 600, color: s.c, letterSpacing: 0.3 }}><SIcon s={s} size={12} /> {s.l}</span>
        <span style={{ fontSize: 11, color: "#8a8078", letterSpacing: 0.2 }}>{sk.ver}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 6 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 24, color: s.c, lineHeight: 1 }}>x{sk.iters}</span>
        <span style={{ fontSize: 10, color: "#a09890", letterSpacing: 0.3 }}>迭代</span>
      </div>
      <div style={{ height: 3, background: "rgba(0,0,0,0.05)", borderRadius: 2, overflow: "hidden", marginBottom: 8 }}>
        <div style={{ height: "100%", width: pct + "%", borderRadius: 2, background: s.tagBg, opacity: 0.7 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#b0a898" }}>
        <span>{sk.source}</span>
        <span>{sk.updated}</span>
      </div>
    </BaseCard>
  );
}
