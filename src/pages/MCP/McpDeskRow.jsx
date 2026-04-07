import { MCP_ST } from "../../constants/status.js";
import { FONT_MONO, DESK } from "../../constants/theme.js";
import { SIcon } from "../../components/ui/Icons.jsx";
import useDeskRow from "../../hooks/useDeskRow.js";
import DeskRowShell from "../../components/cards/DeskRowShell.jsx";
import McpCard from "./McpCard.jsx";
import McpDetail from "./McpDetail.jsx";

export default function McpDeskRow({ status, mcps, onSelect, onViewAll }) {
  const s = MCP_ST[status];
  const dr = useDeskRow(mcps, m => m.id);

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
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <SIcon s={s} size={16} />
            <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: "#4a4540" }}>{s.l}</span>
            <span style={{ fontSize: 14, color: "#a09888", marginLeft: 4 }}>{dr.count} 项能力</span>
          </div>
          <div style={{ fontSize: 12, color: "#c0b5a5" }}>点击查看全部 ▶</div>
        </div>
      )}
      renderCards={() => dr.handCards.map((m, i) => (
        <McpCard key={m.id} m={m} style={dr.getCardStyle(i)}
          hovered={dr.hoverIdx === i && !dr.focusPhase}
          onHover={() => !dr.focusPhase && dr.setHoverIdx(i)}
          onLeave={() => dr.setHoverIdx(null)}
          onClick={e => { e.stopPropagation(); if (!dr.handOpen) dr.setHandOpen(true); else if (!dr.focusPhase) dr.handleCardFocus(m, i); }}
        />
      ))}
      renderDetail={() => dr.focusItem && dr.focusPhase === "detail" && (
        <McpDetail m={dr.focusItem} show={true} onClose={dr.handleDetailClose} />
      )}
    />
  );
}
