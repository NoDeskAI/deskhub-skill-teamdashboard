import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { COLOR, GAP, FONT_SERIF, FONT_MONO, FONT_SANS } from "../../constants/theme.js";

/**
 * 设置面板 —— 主题切换 + 背景音量
 *   - 主题：editorial（当前）↔ classic（原版）切换
 *   - 音量：0~100 滑块，默认极低（5）
 *   - 音频：Perplexity computer.mp3 循环播放
 */
const VOLUME_KEY = "editorial-volume";
const DEFAULT_VOLUME = 5;

export default function EditorialSettings({ show, onClose }) {
  const [volume, setVolume] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_VOLUME;
    const saved = parseInt(localStorage.getItem(VOLUME_KEY) || DEFAULT_VOLUME, 10);
    return isNaN(saved) ? DEFAULT_VOLUME : saved;
  });
  const audioRef = useRef(null);

  // 同步音量到 audio 元素 + localStorage
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
    }
    localStorage.setItem(VOLUME_KEY, String(volume));
  }, [volume]);

  // mount 时尝试自动播放（可能被浏览器策略阻挡，第一次用户交互后会自动开始）
  useEffect(() => {
    if (audioRef.current && volume > 0) {
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const switchToClassic = () => {
    window.location.hash = "";
    window.location.reload();
  };

  return (
    <>
      {/* 始终挂载的音频元素 —— 用户偏好持久化到 localStorage */}
      <audio
        ref={audioRef}
        src="/pplx-computer.mp3"
        loop
        autoPlay
        playsInline
      />

      {/* 设置面板 */}
      {show && (
        <>
          {/* 遮罩 */}
          <div
            onClick={onClose}
            style={{
              position: "fixed", inset: 0, zIndex: 700,
              background: "rgba(15,15,10,0.4)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              animation: "fadeIn 0.25s ease",
            }}
          />
          {/* 面板 */}
          <div style={{
            position: "fixed",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 701,
            width: 460,
            maxWidth: "calc(100vw - 40px)",
            background: "rgba(253,251,250,0.96)",
            backdropFilter: "blur(28px) saturate(1.4)",
            WebkitBackdropFilter: "blur(28px) saturate(1.4)",
            border: "1px solid rgba(255,255,255,0.6)",
            borderRadius: 20,
            padding: "32px 32px 28px",
            boxShadow: "0 30px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.10), 0 0 200px rgba(255,250,235,0.12)",
            animation: "scaleIn 0.3s cubic-bezier(0.2,0.7,0.3,1)",
          }}>
            {/* 顶部 */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              marginBottom: 28, paddingBottom: 20,
              borderBottom: "1px solid rgba(0,0,0,0.08)",
            }}>
              <div>
                <div style={{
                  fontFamily: FONT_MONO, fontSize: 10, color: COLOR.text4,
                  letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 6,
                }}>SETTINGS</div>
                <h2 style={{
                  fontFamily: FONT_SERIF, fontSize: 32, fontWeight: 500,
                  letterSpacing: -0.6, lineHeight: 1, margin: 0, color: COLOR.text,
                }}>
                  设置 <em style={{ fontStyle: "italic", opacity: 0.6, fontWeight: 400, marginLeft: 8 }}>preferences</em>
                </h2>
              </div>
              <button onClick={onClose} style={{
                background: "transparent", border: "none", cursor: "pointer",
                padding: 4, color: COLOR.text4,
              }}>
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {/* 主题切换 */}
            <div style={{ marginBottom: 28 }}>
              <div style={{
                fontFamily: FONT_MONO, fontSize: 10, color: COLOR.text4,
                letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 10,
              }}>THEME</div>
              <div style={{ display: "flex", gap: 10 }}>
                <ThemeButton active label="editorial" desc="Perplexity 风" onClick={() => {}} />
                <ThemeButton label="classic" desc="原版工具风" onClick={switchToClassic} />
              </div>
            </div>

            {/* 背景音乐音量 */}
            <div>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                marginBottom: 10,
              }}>
                <span style={{
                  fontFamily: FONT_MONO, fontSize: 10, color: COLOR.text4,
                  letterSpacing: 1.8, textTransform: "uppercase",
                }}>BACKGROUND AUDIO</span>
                <span style={{
                  fontFamily: FONT_SERIF, fontSize: 18, fontStyle: "italic",
                  color: volume === 0 ? COLOR.text4 : COLOR.text,
                }}>{volume === 0 ? "muted" : `${volume}%`}</span>
              </div>
              <input
                type="range"
                min={0} max={100}
                value={volume}
                onChange={e => setVolume(parseInt(e.target.value, 10))}
                style={{
                  width: "100%",
                  accentColor: "#1a1d18",
                  cursor: "pointer",
                }}
              />
              <div style={{
                fontFamily: FONT_SANS, fontSize: 12, color: COLOR.text4,
                marginTop: 8, lineHeight: 1.5,
              }}>
                Perplexity Computer 主题音乐 · 默认极低，调高有惊喜
              </div>
            </div>
          </div>

          <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes scaleIn {
              from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
              to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }
          `}</style>
        </>
      )}
    </>
  );
}

function ThemeButton({ active, label, desc, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1,
      padding: "14px 16px",
      background: active ? "#1a1d18" : "rgba(0,0,0,0.04)",
      color: active ? "#fdfbfa" : COLOR.text,
      border: active ? "1px solid #1a1d18" : "1px solid rgba(0,0,0,0.10)",
      borderRadius: 12,
      cursor: active ? "default" : "pointer",
      textAlign: "left",
      transition: "all 0.2s",
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.08)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
    >
      <div style={{
        fontFamily: FONT_SERIF, fontSize: 18, fontWeight: 500,
        marginBottom: 4, letterSpacing: -0.2,
      }}>
        {label}
        {active && <span style={{
          marginLeft: 8, fontSize: 10, fontFamily: FONT_MONO, opacity: 0.6,
          letterSpacing: 1.5, textTransform: "uppercase",
        }}>✓ active</span>}
      </div>
      <div style={{
        fontFamily: FONT_SANS, fontSize: 12,
        color: active ? "rgba(253,251,250,0.6)" : COLOR.text4,
      }}>{desc}</div>
    </button>
  );
}
