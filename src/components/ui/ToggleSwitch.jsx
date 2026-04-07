import { FONT_SANS } from "../../constants/theme.js";

/**
 * 药丸形滑动切换开关（如 Skill ⟷ MCP）
 * @param {{ options: {id:string, label:string}[], value: string, onChange: (id:string)=>void }} props
 */
export default function ToggleSwitch({ options, value, onChange }) {
  const activeIdx = options.findIndex(o => o.id === value);
  const w = 200 / options.length;

  return (
    <div style={{
      position: "relative", display: "inline-flex", alignItems: "center",
      width: 200, height: 34, borderRadius: 17,
      background: "rgba(0,0,0,0.06)", padding: 3, userSelect: "none",
    }}>
      {/* 滑动高亮条 */}
      <div style={{
        position: "absolute", top: 3, bottom: 3, left: 3 + activeIdx * (194 / options.length),
        width: 194 / options.length, borderRadius: 14,
        background: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
        transition: "left 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
      }} />
      {/* 选项文字 */}
      {options.map((o) => (
        <div key={o.id} onClick={() => onChange(o.id)} style={{
          position: "relative", zIndex: 1, flex: 1,
          textAlign: "center", cursor: "pointer",
          fontFamily: FONT_SANS, fontSize: 13, fontWeight: 500,
          color: o.id === value ? "#2d2418" : "#8a7a62",
          transition: "color 0.25s",
          lineHeight: "28px",
        }}>
          {o.label}
        </div>
      ))}
    </div>
  );
}
