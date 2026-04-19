import BaseCard from "../../components/cards/BaseCard.jsx";
import { PRI } from "../../constants/priority.js";
import { FONT_MONO, FONT_SANS, FONT_SERIF, COLOR, GAP, FONT_SIZE } from "../../constants/theme.js";

/**
 * 统一工单卡片 — 轻量信息（子阶段/优先级由 desk row 标题承载）
 * 显示：标题、类型标签、方案数+评测进度、日期
 */
export default function WoCard({ wo, style, hovered, onHover, onLeave, onClick, absolute = true }) {
  const pri = PRI[wo.priority];
  const vCount = wo.variants.length;
  const scored = wo.variants.filter(v => v.scores && v.scores.length > 0).length;

  return (
    <BaseCard style={style} hovered={hovered} onHover={onHover} onLeave={onLeave} onClick={onClick} absolute={absolute}>
      {/* 标题 — Editorial 衬线 */}
      <div style={{
        fontFamily: FONT_SERIF, fontSize: 17, fontWeight: 500, color: COLOR.text,
        lineHeight: 1.25, marginBottom: GAP.sm, minHeight: 42,
        letterSpacing: -0.2,
        overflow: "hidden", display: "-webkit-box",
        WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
      }}>
        {wo.name}
      </div>

      {/* 类型 + 优先级 — Editorial mono outline 风 */}
      <div style={{ display: "flex", gap: 6, marginBottom: GAP.md, flexWrap: "wrap" }}>
        <span style={{
          padding: "2px 8px", borderRadius: 999,
          fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 500,
          letterSpacing: 1.2, textTransform: "uppercase",
          border: `1px solid ${wo.type === "skill" ? "rgba(151,67,26,0.45)" : "rgba(32,128,141,0.45)"}`,
          color: wo.type === "skill" ? "#97431a" : "#20808d",
          background: "transparent",
        }}>
          {wo.type === "skill" ? "skill" : "mcp"}
        </span>
        <span style={{
          padding: "2px 8px", borderRadius: 999,
          fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 500,
          letterSpacing: 1.2, textTransform: "uppercase",
          border: `1px solid ${wo.priority === "high" ? "rgba(191,84,33,0.5)" : wo.priority === "medium" ? "rgba(110,107,98,0.4)" : "rgba(168,165,156,0.4)"}`,
          color: wo.priority === "high" ? "#bf5421" : wo.priority === "medium" ? "#6e6b62" : "#8a8780",
          background: "transparent",
        }}>
          {wo.priority === "high" ? "high" : wo.priority === "medium" ? "med" : "low"}
        </span>
      </div>

      {/* 方案数 + 评测进度 */}
      <div style={{
        fontFamily: FONT_SANS, fontSize: FONT_SIZE.sm, color: COLOR.text4,
        marginBottom: GAP.xs,
      }}>
        方案 {vCount}{vCount > 0 && <span style={{ marginLeft: GAP.md }}>评测 {scored}/{vCount}</span>}
      </div>

      {/* 日期 */}
      <div style={{
        fontFamily: FONT_SANS, fontSize: FONT_SIZE.xs, color: "#b5a898",
        textAlign: "right",
      }}>
        {wo.created}
      </div>
    </BaseCard>
  );
}
