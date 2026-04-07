import { Link2 } from "lucide-react";
import { FONT_MONO, FONT_SANS, DESK } from "../../constants/theme.js";
import { DIcon } from "../../components/ui/Icons.jsx";
import useDeskRow from "../../hooks/useDeskRow.js";
import DeskRowShell from "../../components/cards/DeskRowShell.jsx";
import DetailModal from "../../components/ui/DetailModal.jsx";
import TestCard from "./TestCard.jsx";

export default function TestDeskRow({ label, icon, variants, onSelect, onViewAll, dims }) {
  const dr = useDeskRow(variants, v => v.planId + v.id);

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
            <span style={{ fontSize: 14, color: "#a09888", marginLeft: 4 }}>{dr.count} 件</span>
          </div>
          <div style={{ fontSize: 12, color: "#c0b5a5" }}>点击查看全部 ▶</div>
        </div>
      )}
      renderCards={() => dr.handCards.map((v, i) => (
        <TestCard key={v.planId + v.id} v={v} dims={dims} style={dr.getCardStyle(i)}
          hovered={dr.hoverIdx === i && !dr.focusPhase}
          onHover={() => !dr.focusPhase && dr.setHoverIdx(i)}
          onLeave={() => dr.setHoverIdx(null)}
          onClick={e => { e.stopPropagation(); if (!dr.handOpen) dr.setHandOpen(true); else if (!dr.focusPhase) dr.handleCardFocus(v, i); }}
        />
      ))}
      renderDetail={() => dr.focusItem && dr.focusPhase === "detail" && (
        <DetailModal show={true} onClose={dr.handleDetailClose} width={400}>
          <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 16, color: "#3a2a18", lineHeight: 1.5 }}>{dr.focusItem.name}</div>
            <div style={{ fontFamily: FONT_SANS, fontSize: 14, color: "#9a8a68", marginTop: 4 }}>所属: {dr.focusItem.planName} · 上传: {dr.focusItem.uploader} · {dr.focusItem.uploaded}</div>
          </div>
          {dr.focusItem.desc && <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: FONT_SANS, fontSize: 15, color: "#4a4540", lineHeight: 1.5 }}>{dr.focusItem.desc}</div>}
          {dr.focusItem.link && <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: FONT_SANS, fontSize: 13, color: "#6a8aaa", wordBreak: "break-all" }}><Link2 size={11} style={{ verticalAlign: "middle", marginRight: 3 }} />{dr.focusItem.link}</div>}
          <div style={{ padding: "12px 16px" }}>
            {dr.focusItem.tested ? (<>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ padding: "3px 10px", borderRadius: 6, fontFamily: FONT_SANS, fontSize: 14, color: dr.focusItem.passed ? "#4a8a4a" : "#b83a2a", background: dr.focusItem.passed ? "rgba(74,138,74,0.12)" : "rgba(184,58,42,0.1)", border: dr.focusItem.passed ? "1px solid rgba(74,138,74,0.3)" : "1px solid rgba(184,58,42,0.2)" }}>{dr.focusItem.passed ? "✓ 通过" : "✗ 未通过"}</span>
                {dr.focusItem.tester && <span style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#9a8a68" }}>评测: {dr.focusItem.tester} · {dr.focusItem.testedAt}</span>}
              </div>
              {dr.focusItem.scores && Object.keys(dr.focusItem.scores).length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: "#5a5550", marginBottom: 6 }}>评分详情</div>
                  {dims.filter(d => d.active).map(d => <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, padding: "3px 0" }}><span style={{ fontFamily: FONT_SANS, fontSize: 14, color: "#4a4540" }}>{d.name}</span><span style={{ fontFamily: FONT_MONO, fontSize: 14, color: "#8a6a3a" }}>{dr.focusItem.scores[d.id] || 0}/{d.max} ★</span></div>)}
                </div>
              )}
              {dr.focusItem.comment && <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.03)", fontFamily: FONT_SANS, fontSize: 14, color: "#4a4540", lineHeight: 1.5, marginBottom: 6 }}>备注: {dr.focusItem.comment}</div>}
              {dr.focusItem.reportLink && <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#6a8aaa", wordBreak: "break-all" }}><Link2 size={11} style={{ verticalAlign: "middle", marginRight: 3 }} />报告: {dr.focusItem.reportLink}</div>}
            </>) : (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div style={{ fontFamily: FONT_SANS, fontSize: 15, color: "#b8861a", marginBottom: 4 }}>⏳ 待评测</div>
                <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#a09888" }}>该方案尚未进行评测</div>
              </div>
            )}
          </div>
          <div style={{ padding: "8px 16px 12px", borderTop: "1px solid rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#b5b0a5" }}></span>
            <span style={{ cursor: "pointer", fontFamily: FONT_SANS, fontSize: 13, color: "#6a5a42" }} onClick={() => { dr.handleDetailClose(); setTimeout(() => onSelect(dr.focusItem), 800); }}>{dr.focusItem.tested ? "重新评测 →" : "开始评测 →"}</span>
          </div>
        </DetailModal>
      )}
    />
  );
}
