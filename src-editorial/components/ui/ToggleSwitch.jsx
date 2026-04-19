import { FONT_SANS, FONT_SERIF, COLOR, FONT_SIZE } from "../../constants/theme.js";

/**
 * 药丸形滑动切换开关 — Editorial 版：active 文字用 serif italic，bloom 阴影
 */
export default function ToggleSwitch({ options, value, onChange, width }) {
  const activeIdx = options.findIndex(o => o.id === value);
  const totalW = width || Math.max(200, options.length * 80);
  const innerW = totalW - 6;
  const slotW = innerW / options.length;

  return (
    <div style={{
      position: "relative", display: "inline-flex", alignItems: "center",
      width: totalW, height: 36, borderRadius: 999,
      background: "rgba(0,0,0,0.05)",
      padding: 3, userSelect: "none",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
    }}>
      {/* 滑动高亮条 — 加暖色 bloom */}
      <div style={{
        position: "absolute", top: 3, bottom: 3,
        left: 3 + activeIdx * slotW,
        width: slotW, borderRadius: 999,
        background: "rgba(255,253,247,0.95)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.06), 0 0 24px rgba(255,230,180,0.5)",
        transition: "left 0.35s cubic-bezier(0.2, 0.7, 0.3, 1)",
      }} />
      {/* 选项文字 — active 衬线斜体，inactive sans */}
      {options.map((o) => {
        const on = o.id === value;
        return (
          <div key={o.id} onClick={() => onChange(o.id)} style={{
            position: "relative", zIndex: 1, flex: 1,
            textAlign: "center", cursor: "pointer",
            fontFamily: on ? FONT_SERIF : FONT_SANS,
            fontSize: on ? 16 : 13,
            fontStyle: on ? "italic" : "normal",
            fontWeight: on ? 500 : 400,
            color: on ? "#1a1a1a" : COLOR.text4,
            transition: "color 0.25s, font-size 0.25s",
            lineHeight: "30px",
            whiteSpace: "nowrap",
          }}>
            {o.label}
          </div>
        );
      })}
    </div>
  );
}
