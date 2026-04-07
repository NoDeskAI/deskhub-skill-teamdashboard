import { ST } from "../../constants/status.js";
import { FONT_MONO } from "../../constants/theme.js";
import { SIcon } from "../../components/ui/Icons.jsx";
import DetailModal from "../../components/ui/DetailModal.jsx";

export default function SkillDetail({ sk, onClose, show }) {
  if (!sk) return null;
  const s = ST[sk.status]; const pct = Math.round(sk.iters / 25 * 100);
  return (
    <DetailModal show={show} onClose={onClose}>
      <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 16, color: "#2d2418", lineHeight: 1.6, marginBottom: 4 }}>{sk.name}</div>
        <div style={{ fontSize: 13, color: "#8a8078", marginBottom: 8 }}>{sk.slug} · {sk.ver}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ padding: "3px 8px", background: s.tagBg + "20", borderRadius: 6, fontSize: 12, fontWeight: 600, color: s.c }}><SIcon s={s} size={12} /> {s.l}</span>
          <span style={{ padding: "3px 8px", background: "rgba(0,0,0,0.04)", borderRadius: 6, fontSize: 12, color: sk.cat === "mcp" ? "#5a7a9a" : "#7a7a60" }}>{sk.cat === "mcp" ? "MCP" : "Skill"}</span>
          <span style={{ padding: "3px 8px", background: "rgba(0,0,0,0.04)", borderRadius: 6, fontSize: 12, color: "#8a7a68" }}>{sk.source}</span>
        </div>
      </div>
      <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 15, color: "#4a4038", lineHeight: 1.6 }}>{sk.desc}</div>
      <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 16px" }}>
        {[{ l: "迭代", v: sk.iters, c: s.c, px: 1 }, { l: "版本", v: sk.ver }, { l: "来源", v: sk.source }, { l: "下载", v: sk.dl }, { l: "查看", v: sk.views }, { l: "更新", v: sk.updated }].map(it => (
          <div key={it.l}><div style={{ fontSize: 16, color: "#a09888", letterSpacing: 0.3, marginBottom: 2 }}>{it.l}</div><div style={{ fontFamily: it.px ? FONT_MONO : "inherit", fontSize: 16, color: it.c || "#3a3028", fontWeight: it.px ? 400 : 500 }}>{it.v}</div></div>
        ))}
      </div>
      <div style={{ padding: "4px 18px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: "#a09888" }}>迭代进度</span><span style={{ color: s.c, fontFamily: FONT_MONO, fontSize: 15 }}>{pct}%</span>
        </div>
        <div style={{ height: 5, background: "rgba(0,0,0,0.05)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: pct + "%", borderRadius: 3, background: s.tagBg, opacity: 0.7, transition: "width 0.5s" }} />
        </div>
      </div>
    </DetailModal>
  );
}
