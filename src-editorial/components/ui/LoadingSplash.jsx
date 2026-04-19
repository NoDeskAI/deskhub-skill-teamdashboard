import { useEffect, useState, useRef } from "react";
import { FONT_SERIF } from "../../constants/theme.js";

/**
 * 入场动画 —— 直接用 Perplexity 的实测视频
 *   - hero-bg.webm 草甸（带视频动效）做底
 *   - unifies-bg.webm 一条飘带视频盖在上面（Perplexity 同款 windweave）
 *   - 中央 serif "DeskHub 启动"
 *
 * 来源：从 Computer.js bundle 提取的 cloudinary URL，已下载到 dev/public/
 */
export default function LoadingSplash({ onDone, durationMs = 3200 }) {
  const [phase, setPhase] = useState("entering");
  const heroRef = useRef(null);
  const ribbonRef = useRef(null);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("showing"), 60);
    const t2 = setTimeout(() => setPhase("leaving"), durationMs - 700);
    const t3 = setTimeout(() => onDone && onDone(), durationMs);
    // 强制播放（autoplay 可能被浏览器策略阻挡）
    const playMaybe = (el) => el?.play?.()?.catch?.(() => {});
    setTimeout(() => { playMaybe(heroRef.current); playMaybe(ribbonRef.current); }, 30);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone, durationMs]);

  const visible = phase === "showing";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      backgroundColor: "#1a1d18",
      overflow: "hidden",
      opacity: phase === "leaving" ? 0 : 1,
      transition: "opacity 0.7s ease",
      pointerEvents: phase === "leaving" ? "none" : "auto",
    }}>
      {/* 底层：Perplexity 草甸视频 */}
      <video
        ref={heroRef}
        autoPlay loop muted playsInline
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.8s ease",
        }}
      >
        <source src="/hero-bg.webm" type="video/webm" />
        <source src="/hero-bg.mp4" type="video/mp4" />
      </video>

      {/* 上层：Perplexity windweave ribbon 视频（一条大飘带）*/}
      <video
        ref={ribbonRef}
        autoPlay loop muted playsInline
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.9s ease 0.15s",
          mixBlendMode: "screen",
        }}
      >
        <source src="/unifies-bg.webm" type="video/webm" />
      </video>

      {/* 中央 serif 大字 */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        pointerEvents: "none", zIndex: 2,
      }}>
        <div style={{
          fontFamily: FONT_SERIF,
          fontSize: 80, fontWeight: 400,
          letterSpacing: -2,
          color: "#fdfbfa",
          textShadow: "0 2px 32px rgba(0,0,0,0.5), 0 0 60px rgba(255,250,235,0.35)",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.96)",
          transition: "opacity 0.8s ease 0.4s, transform 1s cubic-bezier(0.2,0.7,0.3,1) 0.4s",
        }}>
          DeskHub <em style={{ fontStyle: "italic", color: "#cfeed7" }}>启动</em>
        </div>
      </div>
    </div>
  );
}
