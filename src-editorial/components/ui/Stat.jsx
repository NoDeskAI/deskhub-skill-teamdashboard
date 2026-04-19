import { FONT_MONO, FONT_SERIF, COLOR, GAP, FONT_SIZE, GLASS } from "../../constants/theme.js";

export default function Stat({ label, value, color }) {
  const isEmpty = value === "暂无数据" || value === "—";
  return (
    <div style={{
      background: GLASS.bg,
      backdropFilter: GLASS.blur,
      WebkitBackdropFilter: GLASS.blur,
      border: GLASS.border,
      boxShadow: GLASS.shadow,
      borderRadius: 4,
      padding: `20px 22px 18px`,
      textAlign: "left",
      flex: 1,
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        fontFamily: FONT_MONO,
        fontSize: 10,
        color: COLOR.text4,
        letterSpacing: 1.8,
        textTransform: "uppercase",
        marginBottom: 14,
      }}>{label}</div>
      <div style={{
        fontFamily: FONT_SERIF,
        fontSize: isEmpty ? 18 : 48,
        fontWeight: 300,
        color: isEmpty ? COLOR.dim : (color || COLOR.text),
        lineHeight: 1,
        letterSpacing: -1.2,
        fontStyle: isEmpty ? "italic" : "normal",
      }}>{value}</div>
    </div>
  );
}
