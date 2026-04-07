import { MCP_ST } from "../../constants/status.js";
import { FONT_MONO, FONT_SANS } from "../../constants/theme.js";
import { SIcon } from "../../components/ui/Icons.jsx";
import DetailModal from "../../components/ui/DetailModal.jsx";

export default function McpDetail({ m, onClose, show }) {
  if (!m) return null; const s = MCP_ST[m.status];
  return (
    <DetailModal show={show} onClose={onClose}>
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <SIcon s={s} size={20} />
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 16, color: "#3a2a18", lineHeight: 1.5 }}>{m.name}</div>
            <div style={{ fontFamily: FONT_SANS, fontSize: 15, color: "#9a8a68" }}>{m.slug} · {m.ver}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <span style={{ padding: "2px 7px", background: "rgba(0,0,0,0.05)", borderRadius: 6, fontFamily: FONT_SANS, fontSize: 14, color: s.c }}>{s.l}</span>
          <span style={{ padding: "2px 7px", background: "rgba(0,0,0,0.05)", borderRadius: 6, fontFamily: FONT_SANS, fontSize: 14, color: "#6a8aaa" }}>MCP</span>
        </div>
      </div>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: FONT_SANS, fontSize: 17, color: "#4a4540", lineHeight: 1.5 }}>{m.desc}</div>
      <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontFamily: FONT_SANS }}>
        <div><div style={{ fontSize: 13, color: "#9a8a6a" }}>版本</div><div style={{ fontSize: 20, color: "#3a2a18" }}>{m.ver}</div></div>
        <div><div style={{ fontSize: 13, color: "#9a8a6a" }}>状态</div><div style={{ fontSize: 20, color: s.c }}>{s.l}</div></div>
        <div><div style={{ fontSize: 13, color: "#9a8a6a" }}>维护人</div><div style={{ fontSize: 20, color: "#3a2a18" }}>{m.maintainer}</div></div>
        <div><div style={{ fontSize: 13, color: "#9a8a6a" }}>更新</div><div style={{ fontSize: 20, color: "#3a2a18" }}>{m.updated}</div></div>
      </div>
    </DetailModal>
  );
}
