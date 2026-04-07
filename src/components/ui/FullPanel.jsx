import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { PANEL, FONT_SANS } from "../../constants/theme.js";

/**
 * Container Transform 动画壳 — 从 originRect 展开到近全屏
 * @param {{ show: boolean, onClose: ()=>void, originRect: {top,left,width,height}|null, children: ReactNode }} props
 */
export default function FullPanel({ show, onClose, originRect, children }) {
  // 阶段：hidden → entering → visible → exiting → hidden
  const [phase, setPhase] = useState("hidden");

  useEffect(() => {
    if (show && phase === "hidden") {
      setPhase("entering");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setPhase("visible"));
      });
    } else if (!show && (phase === "visible" || phase === "entering")) {
      setPhase("exiting");
      const t = setTimeout(() => setPhase("hidden"), 500);
      return () => clearTimeout(t);
    }
  }, [show]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (phase === "hidden") return null;

  const isExpanded = phase === "visible";
  const or = originRect || { top: window.innerHeight / 2 - 50, left: window.innerWidth / 2 - 50, width: 100, height: 100 };

  // 目标区域：留 40px 边距
  const margin = 40;
  const target = {
    top: margin, left: margin,
    width: window.innerWidth - margin * 2,
    height: window.innerHeight - margin * 2,
  };

  // 计算从 origin 到 target 的 transform
  const scaleX = isExpanded ? target.width / or.width : 1;
  const scaleY = isExpanded ? target.height / or.height : 1;
  const translateX = isExpanded ? (target.left + target.width / 2) - (or.left + or.width / 2) : 0;
  const translateY = isExpanded ? (target.top + target.height / 2) - (or.top + or.height / 2) : 0;

  return (
    <>
      {/* 背景遮罩 */}
      <div onClick={handleClose} style={{
        position: "fixed", inset: 0, zIndex: PANEL.zIndex - 1,
        background: PANEL.overlay,
        opacity: isExpanded ? 1 : 0,
        transition: "opacity 0.4s ease",
        pointerEvents: isExpanded ? "auto" : "none",
      }} />

      {/* 主面板 */}
      <div style={{
        position: "fixed",
        top: or.top, left: or.left,
        width: or.width, height: or.height,
        zIndex: PANEL.zIndex,
        background: PANEL.bg,
        borderRadius: isExpanded ? 16 : PANEL.radius,
        boxShadow: PANEL.shadow,
        transform: `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`,
        transformOrigin: "center center",
        transition: PANEL.transition,
        overflow: "hidden",
      }}>
        {/* 内容容器 — 反向 scale 让内容保持正常尺寸 */}
        <div style={{
          width: isExpanded ? target.width : or.width,
          height: isExpanded ? target.height : or.height,
          transform: isExpanded ? `scale(${1/scaleX}, ${1/scaleY})` : "none",
          transformOrigin: "center center",
          overflow: "auto",
          opacity: isExpanded ? 1 : 0,
          transition: "opacity 0.3s ease 0.15s",
        }}>
          {/* 关闭按钮 */}
          <div onClick={handleClose} style={{
            position: "sticky", top: 0, zIndex: 10,
            display: "flex", justifyContent: "flex-end", padding: "12px 16px 0",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", background: "rgba(0,0,0,0.04)",
              transition: "background 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.08)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
            >
              <X size={16} color="#8a7a62" />
            </div>
          </div>
          {/* 子内容 */}
          <div style={{ padding: "0 24px 24px" }}>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
