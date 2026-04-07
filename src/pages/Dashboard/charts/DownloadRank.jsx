import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { FONT_SANS } from "../../../constants/theme.js";

const COLORS = ["#b85c1a", "#c4763a", "#d4905a", "#d4a87a", "#c4b89a", "#b0a890", "#a09888", "#909080", "#808878", "#708070"];

/**
 * @param {{ skills?: Array<{ name: string, dl: number }> }} props
 * 接收 skills 数组，内部排序取 Top 10
 */
/** 截断显示名：去括号内容，超 6 字截断 */
function shortName(name) {
  const clean = (name || '').replace(/[（(].+?[)）]/g, '').trim();
  return clean.length > 6 ? clean.slice(0, 6) + '…' : clean;
}

export default function DownloadRank({ skills = [] }) {
  const data = [...skills]
    .sort((a, b) => (b.dl || 0) - (a.dl || 0))
    .slice(0, 10)
    .map(s => ({ name: s.name, short: shortName(s.name), 下载量: s.dl || 0 }));

  if (data.length === 0) {
    return <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 40 }}>暂无数据</div>;
  }

  return (
    <div style={{ width: "100%" }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#7a6a55", marginBottom: 8 }}>下载量 Top 10</div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: "#a09888" }} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} />
          <YAxis type="category" dataKey="short" tick={{ fontSize: 11, fill: "#5a5550" }} width={72} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, fontSize: 12, fontFamily: FONT_SANS }}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
          />
          <Bar dataKey="下载量" radius={[0, 4, 4, 0]} barSize={16}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
