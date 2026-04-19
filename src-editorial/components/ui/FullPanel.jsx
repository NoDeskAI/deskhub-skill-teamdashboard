import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { PANEL, COLOR, GAP } from "../../constants/theme.js";

/**
 * Container Transform 动画壳 — 从 originRect 展开到"页面区"（sidebar 右侧）
 * 使用 top/left/width/height 动画（非 scale），确保内容正常渲染
 *
 * 定位逻辑：
 *   - 找 [data-page-area] 元素（Stage，sidebar 右侧的主页面容器）
 *   - 面板和遮罩都贴在这个 rect 里，不跨 sidebar、不越过右边
 *   - 找不到则回退全 viewport（向后兼容）
 */

// 读"页面区"的 rect；取不到就用 viewport
function getPageAreaRect() {
  if (typeof document === "undefined") return null;
  const el = document.querySelector("[data-page-area]");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export default function FullPanel({ show, onClose, originRect, actions, children }) {
  const [phase, setPhase] = useState("hidden");
  const [pageRect, setPageRect] = useState(null);

  useEffect(() => {
    if (show && phase === "hidden") {
      setPageRect(getPageAreaRect()); // 打开瞬间快照一次
      setPhase("entering");
      let done = false;
      const toVisible = () => { if (!done) { done = true; setPhase("visible"); } };
      // rAF 双帧（正常路径）+ setTimeout 兜底（tab 隐藏时 rAF 暂停也能推进）
      requestAnimationFrame(() => requestAnimationFrame(toVisible));
      const timer = setTimeout(toVisible, 60);
      return () => clearTimeout(timer);
    } else if (!show && (phase === "visible" || phase === "entering")) {
      setPhase("exiting");
      const t = setTimeout(() => setPhase("hidden"), 500);
      return () => clearTimeout(t);
    }
  }, [show]);

  // 展开时监听窗口 resize，面板跟着重新贴合
  useEffect(() => {
    if (phase !== "visible" && phase !== "entering") return;
    const onResize = () => setPageRect(getPageAreaRect());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [phase]);

  const handleClose = useCallback(() => onClose(), [onClose]);

  if (phase === "hidden") return null;

  const isExpanded = phase === "visible";
  const or = originRect || {
    top: window.innerHeight / 2 - 100,
    left: window.innerWidth / 2 - 180,
    width: 360, height: 200,
  };

  // 页面区（优先）或 viewport（兜底）
  const area = pageRect || { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
  const margin = 20;
  const target = {
    top: area.top + margin,
    left: area.left + margin,
    width: area.width - margin * 2,
    height: area.height - margin * 2,
  };

  // 收起状态用 origin rect，展开状态用 target rect
  const rect = isExpanded ? target : or;

  // Portal 到 body —— 脱离 PageCardStack 的 Layer（transform 祖先），
  // position:fixed 才会真正相对于 viewport，否则 rect 坐标会被叠加一次 sidebar 宽度
  return createPortal(
    <>
      {/* 背景遮罩 —— 也贴在页面区，不盖 sidebar */}
      <div onClick={handleClose} style={{
        position: "fixed",
        top: area.top, left: area.left, width: area.width, height: area.height,
        zIndex: PANEL.zIndex - 1,
        background: PANEL.overlay,
        opacity: isExpanded ? 1 : 0,
        transition: "opacity 0.4s ease",
        pointerEvents: isExpanded ? "auto" : "none",
      }} />

      {/* 主面板 — 直接用 overview 的 desk 渐变 + 描边 + 轻阴影 */}
      <div style={{
        position: "fixed",
        top: rect.top, left: rect.left,
        width: rect.width, height: rect.height,
        zIndex: PANEL.zIndex,
        background: COLOR.gradDesk, // 跟 DeskRowShell 一样的暖色渐变
        borderRadius: isExpanded ? 14 : PANEL.radius,
        // 双层阴影：远距大投影拉开边界感 + 近距柔和 + 内顶高光刻画厚度
        boxShadow: isExpanded
          ? "0 40px 100px rgba(0,0,0,0.45), 0 16px 40px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.7)"
          : "0 2px 8px rgba(0,0,0,0.08)",
        border: "1px solid rgba(0,0,0,0.10)",
        overflow: "hidden",
        transition: PANEL.transition,
      }}>
        {/* 可滚动内容区 */}
        <div style={{
          width: "100%", height: "100%",
          overflow: "auto",
          opacity: isExpanded ? 1 : 0,
          transition: "opacity 0.3s ease 0.2s",
        }}>
          {/* 顶栏：操作按钮 + 关闭 —— 顶部 cream 渐隐，跟面板底色同步 */}
          <div style={{
            position: "sticky", top: 0, zIndex: 10,
            display: "flex", alignItems: "center", justifyContent: "flex-end", gap: GAP.md,
            padding: `${GAP.lg}px ${GAP.xl}px 0`,
            background: "linear-gradient(180deg, #ece9e4 0%, rgba(236,233,228,0) 100%)",
          }}>
            {actions}
            <div onClick={handleClose} style={{
              width: 32, height: 32, borderRadius: GAP.md,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              background: "rgba(0,0,0,0.04)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              transition: "background 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.08)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
            >
              <X size={16} color={COLOR.text5} strokeWidth={1.5} />
            </div>
          </div>

          {/* 子内容 */}
          <div style={{ padding: "0 24px 24px" }}>
            {children}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
