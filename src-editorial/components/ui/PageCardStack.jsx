import { useEffect, useRef, useState } from "react";

/**
 * 页转场 v7 —— 纯滑动，不整花活
 *
 * 常态：单层铺满，0 圆角，0 阴影，0 滤镜（跟 sidebar 咬合）
 * forward  (前进)：新页从底向上滑入，底下旧页原样不动
 * backward (后退)：旧页向下滑出，底下新页原样静静躺着
 *
 * 滑动的层也 0 圆角 0 阴影 —— 就是单纯的 translateY，避免圆角→直角的闪烁，
 * 也避免 settle/scale 造成的黑边。
 */

const TAB_ORDER = ["dashboard", "mcp", "workbench"];
const ANIM_MS = 600;
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

const BG_MAP = {
  dashboard: { type: "video", src: "/hero-bg.webm" },     // 花田给 dashboard（温润、能看但不要工作）
  workbench: { type: "video", src: "/hero-bg-alt.webm" }, // 球体回工单台（冷静、不抢戏，适合文字密集）
  mcp:       { type: "image", src: "/hero-mcp.webp" },
};

export default function PageCardStack({ tab, pages }) {
  const [currentTab, setCurrentTab] = useState(tab);
  const [transition, setTransition] = useState(null);
  const lastTabRef = useRef(tab);

  useEffect(() => {
    if (tab === lastTabRef.current) return;
    const prev = lastTabRef.current;
    const prevIdx = TAB_ORDER.indexOf(prev);
    const newIdx = TAB_ORDER.indexOf(tab);
    const direction = newIdx > prevIdx ? "forward" : "backward";

    setTransition({ from: prev, to: tab, direction });
    setCurrentTab(tab);
    lastTabRef.current = tab;

    const t = setTimeout(() => setTransition(null), ANIM_MS + 60);
    return () => clearTimeout(t);
  }, [tab]);

  if (!transition) {
    return (
      <Stage>
        <Layer mode="static" tabId={currentTab}>{pages[currentTab]}</Layer>
      </Stage>
    );
  }

  const tk = `${transition.from}->${transition.to}`;
  if (transition.direction === "forward") {
    // 旧页在底不动；新页在上，从底部滑入
    return (
      <Stage>
        <Layer key={`${tk}:idle-from`} mode="idle" tabId={transition.from}>{pages[transition.from]}</Layer>
        <Layer key={`${tk}:enter`} mode="enter-up" tabId={transition.to}>{pages[transition.to]}</Layer>
      </Stage>
    );
  }
  // backward：新页在底静静躺着；旧页在上，往下滑出
  return (
    <Stage>
      <Layer key={`${tk}:idle-to`} mode="idle" tabId={transition.to}>{pages[transition.to]}</Layer>
      <Layer key={`${tk}:exit`} mode="exit-down" tabId={transition.from}>{pages[transition.from]}</Layer>
    </Stage>
  );
}

function Stage({ children }) {
  // data-page-area：让 FullPanel 可以锚定到"页面区"（sidebar 右侧这块），
  // 而不是 viewport —— 不会跨过 sidebar，也不会超出右边
  return (
    <div data-page-area style={{
      position: "relative",
      flex: 1, minWidth: 0,
      height: "100%",
      overflow: "hidden",
    }}>
      {children}
    </div>
  );
}

function initialState(mode) {
  switch (mode) {
    case "enter-up":  return { tf: "translateY(100%)" };
    case "exit-down": return { tf: "translateY(0)" };
    default:          return { tf: "translateY(0)" };
  }
}

function targetState(mode) {
  switch (mode) {
    case "enter-up":  return { tf: "translateY(0)" };
    case "exit-down": return { tf: "translateY(100%)" };
    default:          return { tf: "translateY(0)" };
  }
}

function Layer({ children, mode, tabId }) {
  // active=false → 初始态；active=true → 目标态（rAF + setTimeout 兜底触发）
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (mode === "static" || mode === "idle") return;
    let done = false;
    const go = () => { if (!done) { done = true; setActive(true); } };
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(go); });
    const timer = setTimeout(go, 60);
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      clearTimeout(timer);
    };
  }, [mode]);

  const state = active ? targetState(mode) : initialState(mode);
  const isMoving = mode === "enter-up" || mode === "exit-down";

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      zIndex: isMoving ? 2 : 1,
      transform: state.tf,
      transition: isMoving ? `transform ${ANIM_MS}ms ${EASING}` : "none",
      // 纯滑动 —— 无圆角、无阴影、无滤镜
      overflow: "hidden",
      display: "flex", flexDirection: "column",
      backgroundColor: "#f5efe5",  // 视频未加载兜底暖色
    }}>
      <BgFor tab={tabId} />

      {/* vignette wash（中心清晰、边缘雾化）*/}
      <div style={{
        position: "absolute", inset: 0,
        background: tabId === "dashboard"
          ? "radial-gradient(ellipse at center, transparent 35%, rgba(250,248,245,0.10) 65%, rgba(250,248,245,0.25) 90%, rgba(250,248,245,0.45) 100%)"
          : "radial-gradient(ellipse at center, transparent 30%, rgba(250,248,245,0.18) 60%, rgba(250,248,245,0.40) 85%, rgba(250,248,245,0.60) 100%)",
        pointerEvents: "none",
        zIndex: 1,
      }} />
      {/* 顶部 wash —— 给 header 一块"纸"*/}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 260,
        background: "linear-gradient(to bottom, rgba(250,248,245,0.55) 0%, rgba(250,248,245,0.30) 45%, rgba(250,248,245,0) 100%)",
        pointerEvents: "none",
        zIndex: 1,
      }} />

      <div style={{
        position: "relative", zIndex: 2,
        flex: 1, overflowY: "auto", overflowX: "hidden",
        color: "#1a1d18",
      }}>
        {children}
      </div>
    </div>
  );
}

function BgFor({ tab }) {
  const bg = BG_MAP[tab] || BG_MAP.dashboard;
  if (bg.type === "video") {
    return (
      <video
        autoPlay loop muted playsInline
        src={bg.src}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
          zIndex: 0, pointerEvents: "none",
        }}
      />
    );
  }
  return (
    <div style={{
      position: "absolute", inset: 0,
      backgroundImage: `url('${bg.src}')`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      zIndex: 0, pointerEvents: "none",
    }} />
  );
}
