import { FONT_MONO, FONT_SANS } from "../../constants/theme.js";
import { avgScore } from "../../utils/helpers.js";

/**
 * 多维度对比表 — 行=维度，列=方案，底行均分，最高分高亮
 */
export default function ComparisonTable({ variants, dims }) {
  const activeDims = dims.filter(d => d.active);

  // 每个方案的各维度均分和总均分
  const data = variants.map(v => {
    const dimAvgs = {};
    activeDims.forEach(d => {
      const entries = (v.scores || []).filter(s => s.dimId === d.id);
      if (entries.length === 0) { dimAvgs[d.id] = null; return; }
      // 按测试员分组取最新
      const byTester = {};
      entries.forEach(s => { if (!byTester[s.tester] || s.date > byTester[s.tester].date) byTester[s.tester] = s; });
      const vals = Object.values(byTester).map(s => s.value);
      dimAvgs[d.id] = vals.reduce((a, b) => a + b, 0) / vals.length;
    });
    return { ...v, dimAvgs, avg: avgScore(v, activeDims) };
  });

  const maxAvg = Math.max(...data.map(d => d.avg));

  if (variants.length === 0) {
    return <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#b5a898", padding: "12px 0" }}>暂无方案</div>;
  }

  return (
    <div style={{ overflowX: "auto", marginBottom: 16 }}>
      <table style={{
        width: "100%", borderCollapse: "collapse",
        fontFamily: FONT_SANS, fontSize: 13,
      }}>
        <thead>
          <tr>
            <th style={thStyle}></th>
            {data.map(v => (
              <th key={v.id} style={{
                ...thStyle, textAlign: "center", fontFamily: FONT_MONO, fontSize: 12,
                color: v.avg === maxAvg && maxAvg > 0 ? "#8a6a3a" : "#4a4540",
              }}>
                {v.avg === maxAvg && maxAvg > 0 && <span style={{ marginRight: 2 }}>🥇</span>}
                {v.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activeDims.map(d => (
            <tr key={d.id}>
              <td style={{ ...tdStyle, color: "#7a6a55", fontWeight: 500, whiteSpace: "nowrap" }}>{d.name}</td>
              {data.map(v => (
                <td key={v.id} style={{ ...tdStyle, textAlign: "center" }}>
                  {v.dimAvgs[d.id] !== null ? (
                    <span style={{ fontFamily: FONT_MONO, color: "#3a2a18" }}>{v.dimAvgs[d.id].toFixed(1)}</span>
                  ) : (
                    <span style={{ color: "#c4bfb5" }}>—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
          {/* 均分行 */}
          <tr style={{ borderTop: "2px solid rgba(0,0,0,0.08)" }}>
            <td style={{ ...tdStyle, color: "#4a4540", fontWeight: 600 }}>均分</td>
            {data.map(v => (
              <td key={v.id} style={{
                ...tdStyle, textAlign: "center",
                background: v.avg === maxAvg && maxAvg > 0 ? "rgba(196,168,112,0.15)" : "transparent",
                borderRadius: 4,
              }}>
                <span style={{
                  fontFamily: FONT_MONO, fontSize: 15, fontWeight: 600,
                  color: v.avg > 0 ? (v.avg === maxAvg ? "#8a6a3a" : "#3a2a18") : "#c4bfb5",
                }}>
                  {v.avg > 0 ? v.avg.toFixed(1) : "—"}
                </span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const thStyle = { padding: "8px 10px", borderBottom: "1px solid rgba(0,0,0,0.08)", textAlign: "left", fontWeight: 500 };
const tdStyle = { padding: "6px 10px", borderBottom: "1px solid rgba(0,0,0,0.04)" };
