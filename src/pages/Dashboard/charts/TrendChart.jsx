import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FONT_SANS } from "../../../constants/theme.js";

/**
 * @param {{ data?: Array<{ date: string, 发布: number }> }} props
 * data 为版本发布按天聚合：[{ date: "04-01", 发布: 5 }, ...]
 */
export default function TrendChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ width: "100%", textAlign: "center", padding: "60px 0" }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 14, color: "#b5a898" }}>暂无数据</div>
        <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#c4bfb5", marginTop: 4 }}>
          版本发布趋势将在有数据后显示
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#7a6a55", marginBottom: 8 }}>
        版本发布趋势
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#a09888" }} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} />
          <YAxis tick={{ fontSize: 11, fill: "#a09888" }} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} />
          <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, fontSize: 12, fontFamily: FONT_SANS }} />
          <Line type="monotone" dataKey="发布" stroke="#b85c1a" strokeWidth={2} dot={{ r: 3, fill: "#b85c1a" }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
