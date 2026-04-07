import { useState } from "react";
import { Plus, FileText, Play, ClipboardCheck, Star, RotateCcw, ExternalLink } from "lucide-react";
import Markdown from "react-markdown";
import { FONT_MONO, FONT_SANS } from "../../constants/theme.js";
import { PRI } from "../../constants/priority.js";
import { PLAN_ST } from "../../constants/status.js";
import { avgScore } from "../../utils/helpers.js";
import FullPanel from "../../components/ui/FullPanel.jsx";
import Accordion from "../../components/ui/Accordion.jsx";
import ComparisonTable from "./ComparisonTable.jsx";

/**
 * 第三层完整面板 — 纯信息展示 + 单角色按钮
 */
export default function WoFullPanel({ wo, dims, show, originRect, onClose, role, onAddVariant, onMarkComplete, onOpenScorePanel, onOpenDocReader, onActivate, onReopen }) {
  const [expandedVar, setExpandedVar] = useState(null);
  const activeDims = (dims || []).filter(d => d.active);

  if (!wo) return null;

  const st = PLAN_ST[wo.status];

  // 构建 Accordion items — 纯展示，无表单
  const accordionItems = wo.variants.map(v => {
    const avg = avgScore(v, activeDims);

    return {
      key: v.id,
      header: (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div>
            <span style={{ fontFamily: FONT_SANS, fontSize: 14, color: "#3a2a18" }}>{v.name}</span>
            <span style={{ fontFamily: FONT_SANS, fontSize: 11, color: "#a09888", marginLeft: 8 }}>
              {v.uploader} · {v.uploaded}
            </span>
          </div>
          <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: avg > 0 ? "#3a2a18" : "#c4bfb5" }}>
            {avg > 0 ? avg.toFixed(1) : "待测"}
          </span>
        </div>
      ),
      content: (
        <div>
          {/* 方案说明 */}
          {v.desc && (
            <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#4a4540", lineHeight: 1.6, marginBottom: 12 }}>
              {v.desc}
            </div>
          )}

          {/* 方案文档 — markdown 预览，点击打开阅读器 */}
          {v.content && (
            <div
              onClick={() => onOpenDocReader && onOpenDocReader(v)}
              style={{
                position: "relative", cursor: "pointer",
                background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.06)",
                borderRadius: 8, padding: 12, marginBottom: 12,
                maxHeight: 120, overflow: "hidden",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(0,0,0,0.15)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(0,0,0,0.06)"}
            >
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                <Markdown components={previewMdComponents}>{v.content}</Markdown>
              </div>
              {/* 渐变遮罩 + 阅读全文提示 */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: 44,
                background: "linear-gradient(transparent 0%, rgba(253,252,250,0.95) 70%)",
                display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 6,
              }}>
                <span style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#8a7a62", fontWeight: 500 }}>
                  <FileText size={11} style={{ verticalAlign: "middle", marginRight: 3 }} />阅读全文
                </span>
              </div>
            </div>
          )}

          {/* 外部链接 */}
          {v.link && (
            <div style={{ marginBottom: 12 }}>
              <a href={ensureUrl(v.link)} target="_blank" rel="noopener noreferrer" style={{
                fontFamily: FONT_SANS, fontSize: 12, color: "#5a7a9a",
                textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 10px", borderRadius: 6,
                background: "rgba(90,122,154,0.08)", border: "1px solid rgba(90,122,154,0.15)",
                transition: "all 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(90,122,154,0.15)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(90,122,154,0.08)"; }}
              >
                <ExternalLink size={11} />
                {v.link.length > 40 ? v.link.slice(0, 40) + "…" : v.link}
              </a>
            </div>
          )}

          {/* 评分记录 */}
          {v.scores && v.scores.length > 0 && (
            <div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: "#7a6a55", marginBottom: 6 }}>评分记录</div>
              {groupScoresByTester(v.scores, activeDims).map((record, idx) => (
                <div key={idx} style={{
                  display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap",
                  padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.03)",
                  fontSize: 12, fontFamily: FONT_SANS,
                }}>
                  <span style={{ color: "#3a2a18", fontWeight: 500, minWidth: 36 }}>{record.tester}</span>
                  <span style={{ color: "#a09888", minWidth: 40 }}>{record.date}</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
                    {record.dims.map(ds => (
                      <span key={ds.dimId} style={{ color: "#5a5550" }}>
                        {ds.dimName} <strong>{ds.value}</strong>/{ds.max || 10}
                      </span>
                    ))}
                  </div>
                  {record.comment && <span style={{ color: "#8a7a62", fontStyle: "italic", width: "100%", paddingLeft: 84 }}>"{record.comment}"</span>}
                  {record.evalDocs && record.evalDocs.length > 0 && (
                    <div style={{ width: "100%", paddingLeft: 84, display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                      {record.evalDocs.map((doc, di) => (
                        <span key={di}
                          onClick={() => onOpenDocReader && onOpenDocReader({ title: doc.title, content: doc.content })}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            padding: "3px 8px", borderRadius: 6, cursor: "pointer",
                            background: "rgba(90,122,154,0.08)", border: "1px solid rgba(90,122,154,0.12)",
                            fontFamily: FONT_SANS, fontSize: 11, color: "#5a7a9a",
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(90,122,154,0.16)"}
                          onMouseLeave={e => e.currentTarget.style.background = "rgba(90,122,154,0.08)"}
                        >
                          <FileText size={10} />{doc.title || `评测文档 ${di + 1}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {v.scores?.length === 0 && (
            <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#c4bfb5", padding: "4px 0" }}>暂无评分</div>
          )}
        </div>
      ),
    };
  });

  // 右上角操作按钮 — 按角色+状态决定
  const actionBtn = (() => {
    if (wo.status === "next" && role === "admin") {
      return (
        <button onClick={() => onActivate && onActivate(wo)} style={btnAction}>
          <Play size={13} style={{ marginRight: 4 }} />激活工单
        </button>
      );
    }
    if (wo.status === "active") {
      if (role === "member") return (
        <button onClick={() => onAddVariant && onAddVariant(wo)} style={btnAction}>
          <Plus size={13} style={{ marginRight: 4 }} />添加方案
        </button>
      );
      if (role === "tester") return (
        <button onClick={() => onOpenScorePanel && onOpenScorePanel()} style={btnAction}>
          <Star size={13} style={{ marginRight: 4 }} />评测打分
        </button>
      );
      if (role === "admin") return (
        <button onClick={() => onMarkComplete && onMarkComplete(wo)} style={btnAction}>
          <ClipboardCheck size={13} style={{ marginRight: 4 }} />定稿
        </button>
      );
    }
    if (wo.status === "done" && role === "admin") {
      return (
        <button onClick={() => onReopen && onReopen(wo)} style={btnActionSecondary}>
          <RotateCcw size={13} style={{ marginRight: 4 }} />撤销定稿
        </button>
      );
    }
    return null;
  })();

  const isOverdue = wo.deadline && wo.status !== "done" && new Date(wo.deadline) < new Date();

  return (
    <FullPanel show={show} onClose={onClose} originRect={originRect} actions={actionBtn}>
      {/* Header — 标题 + 标签 + 元信息 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 20, color: "#3a2a18", marginBottom: 10 }}>{wo.name}</div>

        {/* 标签行 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <span style={{ padding: "3px 8px", background: PRI[wo.priority].bg, borderRadius: 6, fontFamily: FONT_SANS, fontSize: 12, color: PRI[wo.priority].c }}>{PRI[wo.priority].l}</span>
          {st && <span style={{ padding: "3px 8px", background: st.tagBg + "30", borderRadius: 6, fontFamily: FONT_SANS, fontSize: 12, color: st.c }}>{st.l}</span>}
          <span style={{ padding: "3px 8px", background: wo.type === "skill" ? "rgba(138,106,58,0.12)" : "rgba(90,122,154,0.12)", borderRadius: 6, fontFamily: FONT_SANS, fontSize: 12, color: wo.type === "skill" ? "#8a6a3a" : "#5a7a9a" }}>{wo.type === "skill" ? "Skill" : "MCP"}</span>
        </div>

        {/* 元信息栏：负责人 / 截止日 / 创建日 */}
        <div style={{
          display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center",
          padding: "10px 14px", borderRadius: 10,
          background: isOverdue ? "rgba(184,58,42,0.06)" : "rgba(0,0,0,0.025)",
          border: isOverdue ? "1px solid rgba(184,58,42,0.15)" : "1px solid rgba(0,0,0,0.04)",
          marginBottom: 12,
        }}>
          {wo.owner && (
            <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#8a7a62" }}>
              负责人 <span style={{ color: "#3a2a18", fontFamily: FONT_MONO, fontWeight: 500 }}>{wo.owner}</span>
            </div>
          )}
          {wo.deadline && (
            <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: isOverdue ? "#b83a2a" : "#8a7a62" }}>
              截止 <span style={{ color: isOverdue ? "#b83a2a" : "#3a2a18", fontWeight: isOverdue ? 600 : 500, fontFamily: FONT_MONO }}>
                {wo.deadline}
              </span>
              {isOverdue && <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 600 }}>已逾期</span>}
            </div>
          )}
          <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#b5a898" }}>
            创建 <span style={{ fontFamily: FONT_MONO }}>{wo.created}</span>
          </div>
        </div>

        {wo.desc && (
          <div style={{ fontFamily: FONT_SANS, fontSize: 14, color: "#4a4540", lineHeight: 1.6 }}>
            {wo.desc}
          </div>
        )}
      </div>

      {/* 对比表 */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: "#5a5550", marginBottom: 8 }}>方案对比</div>
        <ComparisonTable variants={wo.variants} dims={dims} />
      </div>

      {/* 方案详情 Accordion */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: "#5a5550", marginBottom: 8 }}>
          方案详情 ({wo.variants.length})
        </div>
        {wo.variants.length > 0 ? (
          <Accordion
            items={accordionItems}
            expandedKey={expandedVar}
            onToggle={key => setExpandedVar(prev => prev === key ? null : key)}
          />
        ) : (
          <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#b5a898", padding: "8px 0" }}>暂无方案</div>
        )}
      </div>
    </FullPanel>
  );
}

const btnAction = {
  padding: "6px 14px", borderRadius: 8, cursor: "pointer",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif",
  fontSize: 13, fontWeight: 500,
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "#2d2418", color: "#f5f0e8",
  border: "1px solid #2d2418",
  boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
  transition: "all 0.15s", whiteSpace: "nowrap",
};

const btnActionSecondary = {
  ...btnAction,
  background: "rgba(0,0,0,0.04)", color: "#5a5550",
  border: "1px solid rgba(0,0,0,0.12)",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

/** 确保链接有协议前缀 */
function ensureUrl(link) {
  if (!link) return "#";
  if (/^https?:\/\//i.test(link) || link.startsWith("//")) return link;
  return "https://" + link;
}

// markdown 预览的紧凑样式
const previewMdComponents = {
  h1: ({ children }) => <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: "#3a2a18", fontWeight: 600, marginBottom: 4 }}>{children}</div>,
  h2: ({ children }) => <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#4a4540", fontWeight: 500, marginTop: 6, marginBottom: 2 }}>{children}</div>,
  h3: ({ children }) => <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: "#5a5550", fontWeight: 500, marginTop: 4 }}>{children}</div>,
  p: ({ children }) => <div style={{ fontFamily: FONT_SANS, fontSize: 11, color: "#5a5550", lineHeight: 1.5, marginBottom: 3 }}>{children}</div>,
  ul: ({ children }) => <div style={{ paddingLeft: 12, marginBottom: 3 }}>{children}</div>,
  ol: ({ children }) => <div style={{ paddingLeft: 12, marginBottom: 3 }}>{children}</div>,
  li: ({ children }) => <div style={{ fontFamily: FONT_SANS, fontSize: 11, color: "#5a5550", lineHeight: 1.4 }}>- {children}</div>,
  strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
  table: () => null, // 预览中隐藏表格
  code: ({ children }) => <code style={{ fontFamily: FONT_MONO, fontSize: 10, background: "rgba(0,0,0,0.04)", padding: "0 3px", borderRadius: 2 }}>{children}</code>,
};

/** 按测试员+日期分组评分记录 */
function groupScoresByTester(scores, activeDims) {
  const groups = {};
  scores.forEach(s => {
    const key = `${s.tester}-${s.date}`;
    if (!groups[key]) groups[key] = { tester: s.tester, date: s.date, comment: s.comment || "", evalDocs: [], dims: [] };
    const dim = activeDims.find(d => d.id === s.dimId);
    if (dim) groups[key].dims.push({ dimId: s.dimId, dimName: dim.name, value: s.value, max: dim.max });
    if (s.comment) groups[key].comment = s.comment;
    if (s.evalDoc && groups[key].evalDocs.length === 0) {
      groups[key].evalDocs = parseEvalDocs(s.evalDoc);
    }
  });
  return Object.values(groups);
}

/** 解析 evalDoc：兼容 JSON 数组和旧版纯路径字符串 */
function parseEvalDocs(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(d => d.content);
  } catch { /* not JSON */ }
  return [];
}
