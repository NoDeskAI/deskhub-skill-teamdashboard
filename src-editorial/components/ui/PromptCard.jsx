import { COLOR, GAP, FONT_SANS, FONT_MONO, GLASS } from "../../constants/theme.js";

/**
 * Perplexity Prompt Card — "09 + 文字 + /query"模式
 * 用于"今日待关注"、"建议跟进"这类卡片
 *
 * @param {{ num: string|number, body: string, tag: string, building?: boolean, onClick?: ()=>void }}
 */
export default function PromptCard({ num, body, tag, building, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: GLASS.bg,
      backdropFilter: GLASS.blur,
      WebkitBackdropFilter: GLASS.blur,
      border: GLASS.border,
      boxShadow: GLASS.shadow,
      borderRadius: 4,
      padding: "18px 20px 16px",
      position: "relative",
      cursor: onClick ? "pointer" : "default",
      transition: "transform 0.3s cubic-bezier(.2,.7,.3,1), box-shadow 0.3s",
      flex: 1, minHeight: 140, display: "flex", flexDirection: "column",
    }}
      onMouseEnter={onClick ? (e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = GLASS.shadowHover;
      } : undefined}
      onMouseLeave={onClick ? (e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = GLASS.shadow;
      } : undefined}
    >
      {/* 编号 */}
      <div style={{
        fontFamily: FONT_MONO, fontSize: 11,
        color: COLOR.text4, letterSpacing: 1.2,
        marginBottom: 24,
      }}>{String(num).padStart(2, "0")}</div>

      {/* 正文 */}
      <div style={{
        fontFamily: FONT_SANS, fontSize: 13.5,
        lineHeight: 1.55, color: COLOR.text2,
        flex: 1,
      }}>{body}</div>

      {/* /tag 角标 + 可选 building 状态 */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginTop: 18,
      }}>
        {building ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: COLOR.text4 }}>building...</span>
            <span style={{
              flex: 1, height: 6,
              backgroundImage: "repeating-linear-gradient(90deg, rgba(110,107,98,0.5) 0 2px, transparent 2px 5px)",
              opacity: 0.6,
            }} />
          </div>
        ) : <span />}
        <span style={{
          fontFamily: FONT_MONO, fontSize: 10.5,
          color: COLOR.text4, letterSpacing: 0.5,
        }}>{tag}</span>
      </div>
    </div>
  );
}
