import { useState } from "react";
import { FONT_MONO, FONT_SANS, COLOR, GAP, FONT_SIZE } from "../constants/theme.js";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const disabled = loading || !username.trim() || !password.trim();

  const handleSubmit = async () => {
    if (disabled) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.message || "登录失败");
        return;
      }
      const result = data.data || data;
      onLogin(result.token, result.user);
    } catch (e) {
      setError(e.message || "网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  const inputStyle = {
    width: "100%",
    padding: `${GAP.base}px ${GAP.lg}px`,
    background: "rgba(255,255,255,0.4)",
    border: `1px solid ${COLOR.border}`,
    borderRadius: GAP.md,
    fontFamily: FONT_SANS,
    fontSize: FONT_SIZE.lg,
    color: COLOR.text,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  const labelStyle = {
    fontFamily: FONT_SANS,
    fontSize: FONT_SIZE.md,
    color: COLOR.text3,
    marginBottom: GAP.xs,
  };

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#1a1d18", // 深色兜底，视频加载前看到的是这层
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_SANS,
        overflow: "hidden",
      }}
    >
      {/* 花田背景（不叠丝带，登录页简洁）*/}
      <video
        autoPlay loop muted playsInline
        src="/hero-bg.webm"
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />
      {/* 中心清晰、边缘雾化的 vignette —— 让中央登录卡更聚焦 */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at center, transparent 20%, rgba(26,29,24,0.55) 80%, rgba(26,29,24,0.85) 100%)",
        pointerEvents: "none",
        zIndex: 1,
      }} />
      <div style={{ position: "relative", zIndex: 2, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "rgba(253,251,250,0.82)",
          backdropFilter: "blur(24px) saturate(1.3)",
          WebkitBackdropFilter: "blur(24px) saturate(1.3)",
          border: "1px solid rgba(255,255,255,0.45)",
          borderRadius: 16,
          boxShadow:
            "0 24px 60px rgba(0,0,0,0.30), 0 8px 20px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.55)",
          padding: `${GAP.xxl + 8}px ${GAP.xxl + 4}px ${GAP.xxl}px`,
        }}
      >
        {/* Logo area */}
        <div
          style={{
            textAlign: "center",
            marginBottom: GAP.xxl + 4,
          }}
        >
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 24,
              fontWeight: 600,
              color: COLOR.text,
              letterSpacing: "-0.02em",
            }}
          >
            DeskHub
          </div>
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: FONT_SIZE.base,
              color: COLOR.sub,
              marginTop: GAP.xs,
            }}
          >
            TeamBoard
          </div>
        </div>

        {/* Username */}
        <div style={{ marginBottom: GAP.lg }}>
          <div style={labelStyle}>用户名</div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入用户名"
            style={inputStyle}
            onFocus={(e) => {
              e.target.style.borderColor = COLOR.borderHv;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = COLOR.border;
            }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: GAP.lg }}>
          <div style={labelStyle}>密码</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入密码"
            style={inputStyle}
            onFocus={(e) => {
              e.target.style.borderColor = COLOR.borderHv;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = COLOR.border;
            }}
          />
        </div>

        {/* Login button */}
        <button
          onClick={handleSubmit}
          disabled={disabled}
          style={{
            width: "100%",
            padding: `${GAP.base + 2}px 0`,
            borderRadius: GAP.md,
            background: COLOR.btn,
            color: COLOR.btnText,
            border: "none",
            fontFamily: FONT_SANS,
            fontSize: FONT_SIZE.lg,
            fontWeight: 500,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
            transition: "all 0.15s",
            marginTop: GAP.md,
          }}
          onMouseEnter={(e) => {
            if (!disabled) e.target.style.background = COLOR.btnHover;
          }}
          onMouseLeave={(e) => {
            if (!disabled) e.target.style.background = COLOR.btn;
          }}
        >
          {loading ? "登录中..." : "登录"}
        </button>

        {/* Error message */}
        {error && (
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: FONT_SIZE.md,
              color: COLOR.error,
              textAlign: "center",
              marginTop: GAP.lg,
            }}
          >
            {error}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            textAlign: "center",
            marginTop: GAP.xxl,
            fontFamily: FONT_SANS,
            fontSize: FONT_SIZE.md,
            color: COLOR.sub,
          }}
        >
          团队协作看板
        </div>
      </div>
      </div>
    </div>
  );
}
