import { Pencil, Trash2, Star, Link2 } from "lucide-react";
import { PRI } from "../../constants/priority.js";
import { FONT_MONO, FONT_SANS } from "../../constants/theme.js";
import { FBtn } from "../../components/ui/Form.jsx";
import DetailModal from "../../components/ui/DetailModal.jsx";

export default function PlanDetail({ plan, onClose, show, onEdit, onDelete, onAddVar, onEditVar, onSelVar, onDelVar, role }) {
  if (!plan) return null; const pri = PRI[plan.priority];
  return (
    <DetailModal show={show} onClose={onClose} width={400}>
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 16, color: "#3a2a18", lineHeight: 1.5, flex: 1 }}>{plan.name}</div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 10 }}>
            {role === "admin" && <button onClick={onEdit} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }} title="编辑"><Pencil size={14} /></button>}
            {role === "admin" && <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }} title="删除"><Trash2 size={14} /></button>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ padding: "2px 7px", background: pri.bg, borderRadius: 6, fontFamily: FONT_SANS, fontSize: 14, color: pri.c }}>{pri.l}</span>
          <span style={{ padding: "2px 7px", background: "rgba(0,0,0,0.05)", borderRadius: 6, fontFamily: FONT_SANS, fontSize: 14, color: "#8a8580" }}>{plan.period === "current" ? "当期重点" : "下期规划"}</span>
          <span style={{ fontFamily: FONT_SANS, fontSize: 14, color: "#a89a78" }}>{plan.created}</span>
        </div>
      </div>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: FONT_SANS, fontSize: 17, color: "#4a4540", lineHeight: 1.5 }}>{plan.desc}</div>
      <div style={{ padding: "10px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#5a5550" }}>方案对比 ({plan.variants.length})</span>
          {role !== "tester" && <FBtn label="+ 添加方案" onClick={onAddVar} />}
        </div>
        {plan.variants.length > 0 ? plan.variants.map(v => (
          <div key={v.id} style={{ padding: "10px 12px", marginBottom: 8, borderRadius: 8, background: plan.selected === v.id ? "rgba(74,138,74,0.1)" : "rgba(0,0,0,0.04)", border: plan.selected === v.id ? "2px solid rgba(74,138,74,0.4)" : "1px solid rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {plan.selected === v.id && <Star size={14} fill="#d4a44a" color="#d4a44a" />}
                <span style={{ fontFamily: FONT_SANS, fontSize: 17, color: "#3a2a18" }}>{v.name}</span>
              </div>
              {v.tested ? <span style={{ padding: "1px 6px", borderRadius: 4, fontFamily: FONT_SANS, fontSize: 13, color: v.passed ? "#4a8a4a" : "#b83a2a", background: v.passed ? "#4a8a4a15" : "#b83a2a15" }}>{v.passed ? "通过" : "未通过"}</span> : <span style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#a89a78" }}>待评测</span>}
            </div>
            {v.desc && <div style={{ fontFamily: FONT_SANS, fontSize: 15, color: "#4a4540", lineHeight: 1.4, marginBottom: 4 }}>{v.desc}</div>}
            <div style={{ fontFamily: FONT_SANS, fontSize: 14, color: "#9a8a68", marginBottom: 2 }}>上传: {v.uploader} · {v.uploaded}</div>
            {v.link && <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#6a8aaa", marginBottom: 4, wordBreak: "break-all" }}><Link2 size={11} style={{ verticalAlign: "middle", marginRight: 2 }} /> {v.link}</div>}
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              {role === "admin" && <button onClick={() => onEditVar(v)} style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.03)", cursor: "pointer", fontFamily: FONT_SANS, fontSize: 13, color: "#8a8580" }}><Pencil size={11} style={{ verticalAlign: "middle", marginRight: 2 }} />编辑</button>}
              {role === "admin" && plan.selected !== v.id && <button onClick={() => onSelVar(v.id)} style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(74,138,74,0.3)", background: "rgba(74,138,74,0.08)", cursor: "pointer", fontFamily: FONT_SANS, fontSize: 13, color: "#4a8a4a" }}>⭐ 选定</button>}
              {role === "admin" && <button onClick={() => onDelVar(v.id)} style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(184,58,42,0.2)", background: "rgba(184,58,42,0.05)", cursor: "pointer", fontFamily: FONT_SANS, fontSize: 13, color: "#b83a2a" }}>删除</button>}
            </div>
          </div>
        )) : <div style={{ fontFamily: FONT_SANS, fontSize: 16, color: "#a89a78", textAlign: "center", padding: 16 }}>暂无方案，点击上方添加</div>}
      </div>
    </DetailModal>
  );
}
