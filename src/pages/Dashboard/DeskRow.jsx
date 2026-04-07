import { ST } from "../../constants/status.js";
import { FONT_MONO, DESK } from "../../constants/theme.js";
import { SIcon } from "../../components/ui/Icons.jsx";
import useDeskRow from "../../hooks/useDeskRow.js";
import DeskRowShell from "../../components/cards/DeskRowShell.jsx";
import SkillCard from "./SkillCard.jsx";
import SkillDetail from "./SkillDetail.jsx";

export default function DeskRow({ status, skills, onSelect, onViewAll }) {
  const s = ST[status];
  const sorted = [...skills].sort((a, b) => b.updated.localeCompare(a.updated));
  const dr = useDeskRow(sorted, sk => sk.slug);

  const totalIters = skills.reduce((a, b) => a + b.iters, 0);
  const totalDl = skills.reduce((a, b) => a + b.dl, 0);
  const totalViews = skills.reduce((a, b) => a + b.views, 0);
  const latest = sorted[0];

  return (
    <DeskRowShell {...dr} onViewAll={() => onViewAll(status)}
      renderInfo={() => (
        <div onClick={() => dr.handOpen ? (dr.focusPhase ? null : dr.setHandOpen(false)) : onViewAll(status)} style={{
          position: "absolute", right: 0, top: 0, bottom: 0,
          left: dr.handOpen ? "100%" : (20 + (Math.min(dr.count, 5) - 1) * 38 + DESK.cardW + 20),
          padding: dr.handOpen ? 0 : "14px 16px", display: "flex", flexDirection: "column",
          justifyContent: "center", gap: 6, cursor: "pointer",
          opacity: dr.handOpen ? 0 : 1, overflow: "hidden",
          transition: "opacity 0.3s, left 0.4s",
          borderLeft: dr.handOpen ? "none" : DESK.infoLeft,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, whiteSpace: "nowrap" }}>
            <SIcon s={s} size={16} />
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#4a4540", letterSpacing: 0.3 }}>{s.l}</span>
            <span style={{ fontSize: 13, color: "#a09888", marginLeft: 4 }}>{dr.count} 件技能</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[{ label: "总迭代", val: totalIters, c: s.c }, { label: "下载量", val: totalDl, c: "#7a6a55" }, { label: "查看数", val: totalViews, c: "#7a6a55" }].map(it => (
              <div key={it.label} style={{ background: "rgba(0,0,0,0.04)", borderRadius: 8, padding: "5px 9px" }}>
                <div style={{ fontSize: 10, color: "#a09888", letterSpacing: 0.3, marginBottom: 2 }}>{it.label}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 15, color: it.c }}>{it.val}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, color: "#b5a898", marginTop: 2, whiteSpace: "nowrap" }}>最近: {latest.name} ({latest.updated})</div>
          <div style={{ fontSize: 12, color: "#c0b5a5" }}>点击查看全部 ▶</div>
        </div>
      )}
      renderCards={() => dr.handCards.map((sk, i) => (
        <SkillCard key={sk.slug} sk={sk} style={dr.getCardStyle(i)}
          hovered={dr.hoverIdx === i && !dr.focusPhase}
          onHover={() => !dr.focusPhase && dr.setHoverIdx(i)}
          onLeave={() => dr.setHoverIdx(null)}
          onClick={e => { e.stopPropagation(); if (!dr.handOpen) dr.setHandOpen(true); else if (!dr.focusPhase) dr.handleCardFocus(sk, i); }}
        />
      ))}
      renderDetail={() => dr.focusItem && dr.focusPhase === "detail" && (
        <SkillDetail sk={dr.focusItem} show={true} onClose={dr.handleDetailClose} />
      )}
    />
  );
}
