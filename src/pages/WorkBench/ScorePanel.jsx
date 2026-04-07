import { useState, useEffect, useRef } from "react";
import { X, Upload, FileText } from "lucide-react";
import { FONT_MONO, FONT_SANS } from "../../constants/theme.js";
import StarRate from "../../components/ui/StarRate.jsx";
import { FInput } from "../../components/ui/Form.jsx";
import { td } from "../../utils/helpers.js";

/**
 * 评测打分面板 — 测试员专用，z-index 800 弹窗
 * 选方案 → 上传评测文档（可选）→ 打分 → 提交
 */
export default function ScorePanel({ show, onClose, wo, dims, onSubmitScores }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [selVarId, setSelVarId] = useState(null);
  const [scores, setScores] = useState({});
  const [tester, setTester] = useState("");
  const [comment, setComment] = useState("");
  const [fileName, setFileName] = useState(null);
  const fileRef = useRef(null);

  const activeDims = (dims || []).filter(d => d.active);

  useEffect(() => {
    if (show) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else if (mounted) {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 400);
      return () => clearTimeout(t);
    }
  }, [show]);

  if (!mounted) return null;
  if (!wo) return null;

  const allFilled = selVarId && tester.trim() && activeDims.every(d => scores[d.id] > 0);

  const handleSubmit = () => {
    if (!allFilled) return;
    const scoreEntries = activeDims.map(d => ({
      tester: tester.trim(),
      dimId: d.id,
      value: scores[d.id] || 0,
      comment: comment.trim(),
      date: td(),
      ...(fileName ? { evalDoc: fileName } : {}),
    }));
    onSubmitScores(wo.id, selVarId, scoreEntries);
    setScores({});
    setTester("");
    setComment("");
    setFileName(null);
    setSelVarId(null);
  };

  const handleClose = () => onClose();

  return (
    <div onClick={handleClose} style={{
      position: "fixed", inset: 0, zIndex: 800,
      background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: visible ? 1 : 0,
      transition: "opacity 0.3s",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 420, maxHeight: "85vh",
        background: "linear-gradient(180deg, #fdfcfa 0%, #fff 30%)",
        border: "1px solid rgba(0,0,0,0.1)", borderRadius: 16,
        boxShadow: "0 2px 4px rgba(0,0,0,0.04), 0 8px 20px rgba(0,0,0,0.08), 0 24px 48px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.8)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        transform: visible ? "scale(1) translateY(0)" : "scale(0.88) translateY(24px)",
        transition: "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
      }}>
        {/* 标题栏 */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)",
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: FONT_SANS, fontSize: 16, fontWeight: 600, color: "#3a2a18" }}>评测打分</div>
          <div onClick={handleClose} style={{
            width: 28, height: 28, borderRadius: 7,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", background: "rgba(0,0,0,0.04)", transition: "background 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
          >
            <X size={14} color="#8a7a62" strokeWidth={1.5} />
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
          {/* 方案选择 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#5a5550", marginBottom: 8 }}>选择方案</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {wo.variants.map(v => (
                <div key={v.id} onClick={() => setSelVarId(v.id)} style={{
                  padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                  border: selVarId === v.id ? "2px solid #3a2a18" : "1px solid rgba(0,0,0,0.08)",
                  background: selVarId === v.id ? "rgba(45,36,24,0.06)" : "rgba(0,0,0,0.02)",
                  transition: "all 0.15s",
                }}>
                  <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#3a2a18", fontWeight: 500 }}>{v.name}</div>
                  <div style={{ fontFamily: FONT_SANS, fontSize: 11, color: "#a09888", marginTop: 2 }}>{v.uploader}</div>
                </div>
              ))}
            </div>
            {wo.variants.length === 0 && (
              <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#b5a898" }}>暂无方案可评测</div>
            )}
          </div>

          {/* 上传评测文档（可选） */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#5a5550", marginBottom: 8 }}>评测文档 <span style={{ color: "#b5a898", fontWeight: 400 }}>（选填）</span></div>
            <input ref={fileRef} type="file" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) setFileName(f.name); }} />
            {fileName ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", borderRadius: 8,
                background: "rgba(45,36,24,0.04)", border: "1px solid rgba(0,0,0,0.06)",
              }}>
                <FileText size={14} color="#5a7a9a" />
                <span style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#3a2a18", flex: 1 }}>{fileName}</span>
                <span onClick={() => setFileName(null)} style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#b83a2a", cursor: "pointer" }}>移除</span>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: "1px dashed rgba(0,0,0,0.12)", borderRadius: 8,
                  padding: "14px", textAlign: "center", cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(0,0,0,0.25)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(0,0,0,0.12)"}
              >
                <Upload size={18} color="#a09888" style={{ marginBottom: 4 }} />
                <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#a09888" }}>点击上传评测文档</div>
              </div>
            )}
          </div>

          {/* 逐项评分 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#5a5550", marginBottom: 10 }}>逐项评分</div>
            {activeDims.map(d => (
              <div key={d.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 10,
              }}>
                <span style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#4a4540" }}>{d.name}</span>
                <StarRate value={scores[d.id] || 0} max={d.max} onChange={val => setScores(prev => ({ ...prev, [d.id]: val }))} />
              </div>
            ))}
          </div>

          {/* 测试人 + 评语 */}
          <div style={{ marginBottom: 8 }}>
            <FInput label="测试人" value={tester} onChange={e => setTester(e.target.value)} placeholder="你的名字" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <FInput label="评语" value={comment} onChange={e => setComment(e.target.value)} placeholder="选填" multiline />
          </div>
        </div>

        {/* 提交按钮 */}
        <div style={{ padding: "0 20px 16px", flexShrink: 0 }}>
          <button onClick={handleSubmit} style={{
            width: "100%", padding: "10px", borderRadius: 8,
            cursor: allFilled ? "pointer" : "not-allowed",
            fontFamily: FONT_SANS, fontSize: 14, fontWeight: 500,
            background: allFilled ? "#2d2418" : "rgba(0,0,0,0.04)",
            color: allFilled ? "#f5f0e8" : "#b5b0a5",
            border: allFilled ? "1px solid #2d2418" : "1px solid rgba(0,0,0,0.08)",
            opacity: allFilled ? 1 : 0.6,
            transition: "all 0.15s",
          }}>
            提交评测
          </button>
        </div>
      </div>
    </div>
  );
}
