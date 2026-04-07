import { FONT_MONO, FONT_SANS, MODAL } from "../../constants/theme.js";

export function FormModal({ title, show, onClose, children }) {
  return (<div onClick={onClose} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: MODAL.overlay, zIndex: MODAL.zIndex, display: "flex", alignItems: "center", justifyContent: "center", opacity: show ? 1 : 0, pointerEvents: show ? "auto" : "none", transition: "opacity 0.3s", backdropFilter: MODAL.blur }}>
    <div onClick={e => e.stopPropagation()} style={{ width: 360, maxHeight: "85vh", overflowY: "auto", background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: MODAL.radius, boxShadow: MODAL.shadow, transform: show ? MODAL.scaleVisible : MODAL.scaleHidden, transition: MODAL.transition }}>
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontFamily: FONT_MONO, fontSize: 15, color: "#3a2a18" }}>{title}</div>
      <div style={{ padding: "12px 16px" }}>{children}</div>
    </div>
  </div>);
}

export function FInput({ label, value, onChange, placeholder, multiline }) {
  const s = { width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.4)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 8, fontFamily: FONT_SANS, fontSize: 17, color: "#3a2a18", outline: "none", boxSizing: "border-box", resize: "vertical" };
  return (<div style={{ marginBottom: 12 }}><div style={{ fontFamily: FONT_SANS, fontSize: 15, color: "#5a5550", marginBottom: 4 }}>{label}</div>{multiline ? <textarea value={value} onChange={onChange} placeholder={placeholder} rows={3} style={s} /> : <input value={value} onChange={onChange} placeholder={placeholder} style={s} />}</div>);
}

export function FSelect({ label, value, onChange, options }) {
  return (<div style={{ marginBottom: 12 }}><div style={{ fontFamily: FONT_SANS, fontSize: 15, color: "#5a5550", marginBottom: 4 }}>{label}</div><div style={{ display: "flex", gap: 6 }}>{options.map(o => (<button key={o.v} onClick={() => onChange(o.v)} style={{ padding: "5px 10px", borderRadius: 6, cursor: "pointer", background: value === o.v ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.3)", border: value === o.v ? "2px solid rgba(0,0,0,0.12)" : "1px solid rgba(0,0,0,0.06)", fontFamily: FONT_SANS, fontSize: 15, color: o.c || "#3a2a18" }}>{o.l}</button>))}</div></div>);
}

export function FBtn({ label, onClick, full }) {
  return (<button onClick={onClick} style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer", background: "rgba(0,0,0,0.08)", border: "1px solid rgba(0,0,0,0.06)", fontFamily: FONT_SANS, fontSize: 17, color: "#3a2a18", width: full ? "100%" : "auto" }}>{label}</button>);
}
