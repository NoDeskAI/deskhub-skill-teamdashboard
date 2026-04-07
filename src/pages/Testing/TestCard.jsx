import { Star } from "lucide-react";
import { FONT_MONO, FONT_SANS } from "../../constants/theme.js";
import BaseCard from "../../components/cards/BaseCard.jsx";

export default function TestCard({ v, style, hovered, onHover, onLeave, onClick, absolute = true, dims }) {
  const activeDims = dims ? dims.filter(d => d.active) : [];
  const scored = v.scores && activeDims.length > 0;
  return (
    <BaseCard style={style} hovered={hovered} onHover={onHover} onLeave={onLeave} onClick={onClick} absolute={absolute}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#3a2a18", lineHeight: 1.6, marginBottom: 4, minHeight: 22 }}>{v.name}</div>
      <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#9a8a68", marginBottom: 4 }}>{v.planName}</div>
      {v.tested ? (
        <div style={{ display: "inline-block", padding: "1px 5px", borderRadius: 4, fontFamily: FONT_SANS, fontSize: 12, color: v.passed ? "#4a8a4a" : "#b83a2a", background: v.passed ? "#4a8a4a15" : "#b83a2a15", marginBottom: 3 }}>{v.passed ? "通过" : "未通过"}</div>
      ) : (
        <div style={{ display: "inline-block", padding: "1px 5px", borderRadius: 4, fontFamily: FONT_SANS, fontSize: 12, color: "#b8861a", background: "#b8861a15", marginBottom: 3 }}>待评测</div>
      )}
      {v.tested && scored && (
        <div style={{ marginBottom: 2 }}>
          {activeDims.slice(0, 3).map(d => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: FONT_SANS, fontSize: 11 }}>
              <span style={{ color: "#9a8a68" }}>{d.name}</span>
              <span style={{ color: "#c4a870", letterSpacing: -1 }}>{Array.from({ length: d.max }, (_, i) => <Star key={i} size={10} fill={i < (v.scores[d.id] || 0) ? "#c4a870" : "none"} color={i < (v.scores[d.id] || 0) ? "#c4a870" : "rgba(0,0,0,0.08)"} style={{ verticalAlign: "middle" }} />)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_SANS, fontSize: 11, marginTop: 2 }}>
        <span style={{ color: "#9a8a68" }}>{v.uploader}</span>
        <span style={{ color: "#a89a78" }}>{v.uploaded}</span>
      </div>
      {v.tester && <div style={{ fontFamily: FONT_SANS, fontSize: 11, color: "#8a9a6a", marginTop: 1 }}>评测: {v.tester}</div>}
    </BaseCard>
  );
}
