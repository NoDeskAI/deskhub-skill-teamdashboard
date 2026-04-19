import { CARD, GLASS } from "../../constants/theme.js";

export default function BaseCard({ style, hovered, onHover, onLeave, onClick, absolute = true, children }) {
  return (
    <div onMouseEnter={onHover} onMouseLeave={onLeave} onClick={onClick}
      style={{
        position: absolute ? "absolute" : "relative",
        width: CARD.w, height: CARD.h,
        background: hovered ? GLASS.bgHover : GLASS.bg,
        backdropFilter: GLASS.blur,
        WebkitBackdropFilter: GLASS.blur,
        border: hovered ? CARD.borderHover : GLASS.border,
        borderRadius: CARD.radius, cursor: "pointer",
        boxShadow: hovered ? CARD.shadowHover : GLASS.shadow,
        transition: CARD.transition,
        transformOrigin: "bottom center", overflow: "hidden",
        ...(absolute ? style : { transform: hovered ? `translateY(${CARD.hoverY}px) scale(${CARD.hoverScale})` : "none", ...style }),
      }}>
      <div style={{ padding: CARD.padding }}>
        {children}
      </div>
    </div>
  );
}
