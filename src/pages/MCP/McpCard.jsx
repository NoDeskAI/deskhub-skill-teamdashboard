import { MCP_ST } from "../../constants/status.js";
import { FONT_MONO, FONT_SANS } from "../../constants/theme.js";
import { SIcon } from "../../components/ui/Icons.jsx";
import BaseCard from "../../components/cards/BaseCard.jsx";

export default function McpCard({ m, style, hovered, onHover, onLeave, onClick, absolute = true }) {
  const s = MCP_ST[m.status];
  return (
    <BaseCard style={style} hovered={hovered} onHover={onHover} onLeave={onLeave} onClick={onClick} absolute={absolute}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
        <SIcon s={s} size={11} />
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#3a2a18", lineHeight: 1.5 }}>{m.name}</span>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
        <span style={{ padding: "1px 4px", background: "rgba(0,0,0,0.05)", borderRadius: 4, fontFamily: FONT_SANS, fontSize: 11, color: s.c }}>{s.l}</span>
        <span style={{ fontFamily: FONT_SANS, fontSize: 11, color: "#9a8a68" }}>{m.ver}</span>
      </div>
      <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#4a4540", lineHeight: 1.3, marginBottom: 5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.desc}</div>
      <div style={{ fontFamily: FONT_SANS, fontSize: 11, color: "#9a8a68", marginBottom: 2 }}>维护: {m.maintainer || '—'}</div>
      <div style={{ fontFamily: FONT_SANS, fontSize: 11, color: "#a89a78", textAlign: "right" }}>{m.updated}</div>
    </BaseCard>
  );
}
