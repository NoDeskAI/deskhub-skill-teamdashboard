import { useState } from "react";
import { FONT_MONO, FONT_SANS } from "../../constants/theme.js";
import StarRate from "../../components/ui/StarRate.jsx";
import { FInput } from "../../components/ui/Form.jsx";
import { td } from "../../utils/helpers.js";

/**
 * 评分表单 — 多维度 StarRate + 测试人 + 评语
 * @param {{ variant, dims, onSubmit: (scores)=>void, role }} props
 */
export default function ScoreForm({ variant, dims, onSubmit, role }) {
  const activeDims = dims.filter(d => d.active);
  const [scores, setScores] = useState({});
  const [tester, setTester] = useState("");
  const [comment, setComment] = useState("");

  if (role === "member") return null;

  const allFilled = activeDims.every(d => scores[d.id] > 0) && tester.trim();

  const handleSubmit = () => {
    if (!allFilled) return;
    const scoreEntries = activeDims.map(d => ({
      tester: tester.trim(),
      dimId: d.id,
      value: scores[d.id],
      comment: comment.trim(),
      date: td(),
    }));
    onSubmit(scoreEntries);
    // 重置表单
    setScores({});
    setTester("");
    setComment("");
  };

  return (
    <div style={{
      marginTop: 12, padding: "12px",
      background: "rgba(0,0,0,0.02)", borderRadius: 10,
      border: "1px solid rgba(0,0,0,0.04)",
    }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: "#5a5550", marginBottom: 10 }}>
        提交评分
      </div>

      {/* 各维度打分 */}
      {activeDims.map(d => (
        <div key={d.id} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 8,
        }}>
          <span style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#4a4540" }}>{d.name}</span>
          <StarRate
            value={scores[d.id] || 0}
            max={d.max}
            onChange={val => setScores(prev => ({ ...prev, [d.id]: val }))}
          />
        </div>
      ))}

      {/* 测试人 */}
      <div style={{ marginTop: 8 }}>
        <FInput
          label="测试人"
          value={tester}
          onChange={e => setTester(e.target.value)}
          placeholder="你的名字"
        />
      </div>

      {/* 评语 */}
      <div style={{ marginTop: 4 }}>
        <FInput
          label="评语"
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="选填"
          multiline
        />
      </div>

      {/* 提交按钮 */}
      <button onClick={handleSubmit} style={{
        width: "100%", padding: "8px", borderRadius: 8, marginTop: 8,
        cursor: allFilled ? "pointer" : "not-allowed",
        fontFamily: FONT_SANS, fontSize: 14, border: "1px solid rgba(0,0,0,0.06)",
        background: allFilled ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.03)",
        color: allFilled ? "#3a2a18" : "#b5b0a5",
        opacity: allFilled ? 1 : 0.5,
        transition: "all 0.15s",
      }}>
        提交评分
      </button>
    </div>
  );
}
