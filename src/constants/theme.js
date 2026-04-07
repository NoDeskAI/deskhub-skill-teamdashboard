// Font families — Dashboard 基准
export const FONT_MONO = "'SF Mono', 'Cascadia Code', 'Menlo', monospace";
export const FONT_SANS = "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";

// Card shell — 锚定 SkillCard
export const CARD = {
  w: 126,
  h: 164,
  radius: 12,
  bg: "#f6f1ea",
  bgHover: "#faf7f2",
  border: "1px solid rgba(0,0,0,0.06)",
  borderHover: "1px solid rgba(0,0,0,0.12)",
  shadow: "0 1px 4px rgba(0,0,0,0.1), 0 0 0 0.5px rgba(0,0,0,0.04)",
  shadowHover: "0 12px 32px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)",
  transition: "all 0.35s cubic-bezier(0.25, 1, 0.5, 1)",
  hoverY: -10,
  hoverScale: 1.04,
  padding: "10px 10px 8px",
};

// Detail modal — 锚定 SkillDetail
export const MODAL = {
  zIndex: 600,
  overlay: "rgba(0,0,0,0.35)",
  blur: "blur(3px)",
  radius: 16,
  width: 340,
  shadow: "0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)",
  scaleHidden: "scale(0.92) translateY(20px)",
  scaleVisible: "scale(1) translateY(0)",
  transition: "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
};

// DeskRow — 锚定 Dashboard DeskRow
export const DESK = {
  height: 200,
  radius: 14,
  bg: "linear-gradient(180deg, #ede8e0, #e8e2d8)",
  borderClosed: "1px solid rgba(0,0,0,0.05)",
  borderOpen: "1px solid rgba(0,0,0,0.06)",
  shadowClosed: "0 1px 4px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)",
  shadowOpen: "0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5)",
  infoLeft: "1px dashed rgba(0,0,0,0.05)",
  lines: [40, 85, 130, 170],
  maxHand: 7,
  cardW: 126,
  stackY: 18,
};

// Browse page — 锚定 CardBrowse
export const BROWSE = {
  backRadius: 10,
  backPadding: "7px 14px",
  backFontSize: 13,
  backFontWeight: 500,
  backColor: "#8a7a62",
  searchBg: "#fff",
  searchRadius: 12,
  searchFontSize: 14,
  gridMin: 128,
};
