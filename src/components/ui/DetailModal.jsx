import { MODAL, FONT_SANS } from "../../constants/theme.js";

export default function DetailModal({ show, onClose, width, children }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: MODAL.overlay, zIndex: MODAL.zIndex,
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: show ? 1 : 0, pointerEvents: show ? "auto" : "none",
      transition: "opacity 0.3s",
      backdropFilter: MODAL.blur,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: width || MODAL.width, maxHeight: "85vh",
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: MODAL.radius,
        boxShadow: MODAL.shadow,
        overflow: "auto",
        transform: show ? MODAL.scaleVisible : MODAL.scaleHidden,
        transition: MODAL.transition,
      }}>
        {children}
        <div style={{
          textAlign: "center", padding: "8px 0 12px",
          fontSize: 12, color: "#b0a898",
          borderTop: "1px solid rgba(0,0,0,0.05)",
          fontFamily: FONT_SANS,
        }}>点击外部关闭</div>
      </div>
    </div>
  );
}
