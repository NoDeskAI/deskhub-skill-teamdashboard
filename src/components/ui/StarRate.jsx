import { Star } from "lucide-react";

export default function StarRate({ value, max, onChange }) {
  return (<div style={{ display: "flex", gap: 2 }}>{Array.from({ length: max }, (_, i) => (
    <span key={i} onClick={() => onChange(i + 1)} style={{ cursor: "pointer", transition: "color 0.15s", color: i < value ? "#c4a870" : "rgba(0,0,0,0.08)" }}><Star size={16} fill={i < value ? "#c4a870" : "none"} /></span>
  ))}</div>);
}
