import { Star } from "lucide-react";
import { PRI } from "../../constants/priority.js";
import { FONT_MONO, FONT_SANS, DESK } from "../../constants/theme.js";
import { DIcon } from "../../components/ui/Icons.jsx";
import useDeskRow from "../../hooks/useDeskRow.js";
import DeskRowShell from "../../components/cards/DeskRowShell.jsx";
import DetailModal from "../../components/ui/DetailModal.jsx";
import PlanCard from "./PlanCard.jsx";

export default function PlanDeskRow({ label, icon, plans, onSelect, onViewAll }) {
  const sorted = [...plans].sort((a, b) => b.created.localeCompare(a.created));
  const dr = useDeskRow(sorted, p => p.id);

  const hC = plans.filter(p => p.priority === "high").length;
  const tV = plans.reduce((a, p) => a + p.variants.length, 0);
  const teV = plans.reduce((a, p) => a + p.variants.filter(v => v.tested).length, 0);

  return (
    <DeskRowShell {...dr} onViewAll={onViewAll}
      renderInfo={() => (
        <div onClick={() => dr.handOpen ? (dr.focusPhase ? null : dr.setHandOpen(false)) : onViewAll()} style={{
          position: "absolute", right: 0, top: 0, bottom: 0,
          left: dr.handOpen ? "100%" : (20 + (Math.min(dr.count, 5) - 1) * 38 + DESK.cardW + 20),
          padding: dr.handOpen ? 0 : "14px 16px", display: "flex", flexDirection: "column",
          justifyContent: "center", gap: 6, cursor: "pointer",
          opacity: dr.handOpen ? 0 : 1, overflow: "hidden",
          transition: "opacity 0.3s, left 0.4s",
          borderLeft: dr.handOpen ? "none" : DESK.infoLeft,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <DIcon name={icon} size={16} />
            <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: "#4a4540" }}>{label}</span>
            <span style={{ fontSize: 14, color: "#a09888", marginLeft: 4 }}>{dr.count} 件工单</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[{ label: "高优先", val: hC, c: "#b83a2a" }, { label: "总方案", val: tV, c: "#7a6a55" }, { label: "已测试", val: teV + "/" + tV, c: "#7a6a55" }].map(it => (
              <div key={it.label} style={{ background: "rgba(0,0,0,0.04)", borderRadius: 8, padding: "4px 8px" }}>
                <div style={{ fontSize: 10, color: "#a09888", marginBottom: 2 }}>{it.label}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 14, color: it.c }}>{it.val}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#c0b5a5" }}>点击查看全部 ▶</div>
        </div>
      )}
      renderCards={() => dr.handCards.map((p, i) => (
        <PlanCard key={p.id} plan={p} style={dr.getCardStyle(i)}
          hovered={dr.hoverIdx === i && !dr.focusPhase}
          onHover={() => !dr.focusPhase && dr.setHoverIdx(i)}
          onLeave={() => dr.setHoverIdx(null)}
          onClick={e => { e.stopPropagation(); if (!dr.handOpen) dr.setHandOpen(true); else if (!dr.focusPhase) dr.handleCardFocus(p, i); }}
        />
      ))}
      renderDetail={() => dr.focusItem && dr.focusPhase === "detail" && (
        <DetailModal show={true} onClose={dr.handleDetailClose} width={400}>
          <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 16, color: "#3a2a18", lineHeight: 1.5 }}>{dr.focusItem.name}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              <span style={{ padding: "2px 7px", background: PRI[dr.focusItem.priority].bg, borderRadius: 6, fontFamily: FONT_SANS, fontSize: 14, color: PRI[dr.focusItem.priority].c }}>{PRI[dr.focusItem.priority].l}</span>
              <span style={{ padding: "2px 7px", background: "rgba(0,0,0,0.05)", borderRadius: 6, fontFamily: FONT_SANS, fontSize: 14, color: "#8a8580" }}>{dr.focusItem.period === "current" ? "当期重点" : "下期规划"}</span>
              <span style={{ fontFamily: FONT_SANS, fontSize: 14, color: "#a89a78" }}>{dr.focusItem.created}</span>
            </div>
          </div>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: FONT_SANS, fontSize: 15, color: "#4a4540", lineHeight: 1.5 }}>{dr.focusItem.desc}</div>
          <div style={{ padding: "10px 16px" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#5a5550", marginBottom: 10 }}>方案对比 ({dr.focusItem.variants.length})</div>
            {dr.focusItem.variants.length > 0 ? dr.focusItem.variants.map(v => (
              <div key={v.id} style={{ padding: "8px 10px", marginBottom: 6, borderRadius: 8, background: dr.focusItem.selected === v.id ? "rgba(74,138,74,0.1)" : "rgba(0,0,0,0.04)", border: dr.focusItem.selected === v.id ? "2px solid rgba(74,138,74,0.4)" : "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    {dr.focusItem.selected === v.id && <Star size={12} fill="#d4a44a" color="#d4a44a" />}
                    <span style={{ fontFamily: FONT_SANS, fontSize: 15, color: "#3a2a18" }}>{v.name}</span>
                  </div>
                  {v.tested ? <span style={{ padding: "1px 5px", borderRadius: 4, fontFamily: FONT_SANS, fontSize: 12, color: v.passed ? "#4a8a4a" : "#b83a2a", background: v.passed ? "#4a8a4a15" : "#b83a2a15" }}>{v.passed ? "通过" : "未通过"}</span> : <span style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#a89a78" }}>待评测</span>}
                </div>
                <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#9a8a68" }}>{v.uploader} · {v.uploaded}</div>
              </div>
            )) : <div style={{ fontFamily: FONT_SANS, fontSize: 14, color: "#a89a78", textAlign: "center", padding: 12 }}>暂无方案</div>}
          </div>
          <div style={{ padding: "8px 16px 12px", borderTop: "1px solid rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#b5b0a5" }}></span>
            <span style={{ cursor: "pointer", fontFamily: FONT_SANS, fontSize: 13, color: "#6a5a42" }} onClick={() => { dr.handleDetailClose(); setTimeout(() => onSelect(dr.focusItem), 800); }}>编辑管理 →</span>
          </div>
        </DetailModal>
      )}
    />
  );
}
