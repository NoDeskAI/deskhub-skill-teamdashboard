import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FONT_MONO, FONT_SERIF, FONT_SANS, COLOR, GAP } from "../../constants/theme.js";

/**
 * Editorial Section —— 大字 serif italic 标题 + mono 编号 + hairline 分隔
 * 取代原来 mono 14px 小字风
 */
export default function WoSection({ title, titleEm, num, icon, collapsible = false, defaultCollapsed = false, count, children }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div style={{ marginBottom: 36 }}>
      {/* hairline + 标题行 */}
      <div
        onClick={collapsible ? () => setCollapsed(c => !c) : undefined}
        style={{
          paddingTop: GAP.lg,
          marginBottom: collapsed ? 0 : GAP.xl,
          display: "flex", alignItems: "baseline", gap: GAP.lg,
          cursor: collapsible ? "pointer" : "default",
          userSelect: "none",
          borderTop: "1px solid rgba(39,26,0,0.12)",
        }}
      >
        {/* mono 编号 */}
        {num && (
          <span style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: "currentColor",
            opacity: 0.5,
            letterSpacing: 1.8,
            textTransform: "uppercase",
            paddingTop: 14,
            textShadow: "0 1px 4px rgba(0,0,0,0.18)",
          }}>{num}</span>
        )}

        {/* 大字 serif 标题 */}
        <h3 style={{
          fontFamily: FONT_SERIF,
          fontSize: 36,
          fontWeight: 500,
          letterSpacing: -0.7,
          lineHeight: 1.1,
          color: "currentColor",
          margin: 0,
          textShadow: "0 2px 8px rgba(0,0,0,0.2)",
        }}>
          {title}
          {titleEm && (
            <em style={{
              fontStyle: "italic",
              opacity: 0.55,
              marginLeft: 12,
              fontWeight: 400,
            }}>{titleEm}</em>
          )}
        </h3>

        {/* 数量 */}
        {count !== undefined && (
          <span style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: "currentColor",
            opacity: 0.55,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            textShadow: "0 1px 4px rgba(0,0,0,0.18)",
          }}>· {count} ITEMS</span>
        )}

        {collapsible && (
          <ChevronDown size={16} style={{
            color: "currentColor",
            opacity: 0.5,
            marginLeft: "auto",
            transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
            transition: "transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
          }} />
        )}
      </div>

      {/* 内容区 */}
      {!collapsed && children}
    </div>
  );
}
