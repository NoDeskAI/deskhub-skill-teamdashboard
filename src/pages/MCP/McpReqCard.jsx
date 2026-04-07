import { PRI } from "../../constants/priority.js";
import { MR_ST } from "../../constants/status.js";
import { FONT_MONO, FONT_SANS } from "../../constants/theme.js";
import BaseCard from "../../components/cards/BaseCard.jsx";

export default function McpReqCard({ r, style, hovered, onHover, onLeave, onClick, absolute = true }) {
  const pri = PRI[r.priority]; const rs = MR_ST[r.status];
  return (
    <BaseCard style={style} hovered={hovered} onHover={onHover} onLeave={onLeave} onClick={onClick} absolute={absolute}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#3a2a18", lineHeight: 1.6, marginBottom: 4, minHeight: 22 }}>{r.name}</div>
      <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
        <span style={{ padding: "1px 4px", background: pri.bg, borderRadius: 4, fontFamily: FONT_SANS, fontSize: 11, color: pri.c }}>{pri.l}</span>
        <span style={{ padding: "1px 4px", background: "rgba(0,0,0,0.05)", borderRadius: 4, fontFamily: FONT_SANS, fontSize: 11, color: rs.c }}>{rs.l}</span>
      </div>
      <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#4a4540", lineHeight: 1.3, marginBottom: 5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.desc}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_SANS, fontSize: 11 }}>
        <span style={{ color: "#9a8a68" }}>{r.submitter}</span>
        <span style={{ color: "#a89a78" }}>{r.created}</span>
      </div>
    </BaseCard>
  );
}
