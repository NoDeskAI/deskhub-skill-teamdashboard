import { FONT_MONO } from "../../constants/theme.js";

export default function Stat({ label, value, color }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", border: "1px solid rgba(0,0,0,0.06)", textAlign: "center", flex: 1, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ fontSize: 11, color: "#a09888", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 24, color, lineHeight: 1 }}>{value}</div>
    </div>
  );
}
