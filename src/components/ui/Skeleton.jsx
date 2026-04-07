import { FONT_SANS } from "../../constants/theme.js";

const pulse = {
  animation: 'skeletonPulse 1.5s ease-in-out infinite',
};

const injectKeyframes = (() => {
  let injected = false;
  return () => {
    if (injected || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.textContent = `@keyframes skeletonPulse { 0%,100%{opacity:0.6} 50%{opacity:1} }`;
    document.head.appendChild(style);
    injected = true;
  };
})();

function Bar({ w = '100%', h = 16, r = 6, mb = 8 }) {
  injectKeyframes();
  return <div style={{ width: w, height: h, borderRadius: r, background: '#e8e4de', marginBottom: mb, ...pulse }} />;
}

/** 统计卡片骨架 */
function StatRow({ count = 4 }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ flex: 1, padding: '14px 12px', borderRadius: 10, background: '#f2efe9', ...pulse }}>
          <Bar w="50%" h={10} mb={6} />
          <Bar w="40%" h={22} mb={0} />
        </div>
      ))}
    </div>
  );
}

/** 图表区域骨架 */
function ChartSkeleton() {
  return (
    <div style={{ borderRadius: 12, background: '#f2efe9', padding: 16, marginBottom: 16, ...pulse }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <Bar w={60} h={24} r={6} mb={0} />
        <Bar w={60} h={24} r={6} mb={0} />
        <Bar w={60} h={24} r={6} mb={0} />
      </div>
      <Bar w="100%" h={180} r={8} mb={0} />
    </div>
  );
}

/** DeskRow 骨架 */
function RowSkeleton() {
  return (
    <div style={{ borderRadius: 14, background: '#f2efe9', padding: '16px 20px', marginBottom: 12, ...pulse }}>
      <Bar w={100} h={14} mb={10} />
      <div style={{ display: 'flex', gap: 10 }}>
        {[1, 2, 3, 4].map(i => <Bar key={i} w={126} h={140} r={12} mb={0} />)}
      </div>
    </div>
  );
}

/** Dashboard 完整骨架 */
export function DashboardSkeleton() {
  return (
    <>
      <StatRow count={3} />
      <StatRow count={4} />
      <ChartSkeleton />
      <RowSkeleton />
      <RowSkeleton />
    </>
  );
}

/** MCP 完整骨架 */
export function McpSkeleton() {
  return (
    <div style={{ padding: '0 0 40px' }}>
      <StatRow count={4} />
      <ChartSkeleton />
      <RowSkeleton />
    </div>
  );
}

/** 错误 + 重试 */
export function ErrorRetry({ message, onRetry }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: 14, color: '#b83a2a', marginBottom: 12 }}>
        {message || '数据加载失败'}
      </div>
      <button onClick={onRetry} style={{
        fontFamily: FONT_SANS, fontSize: 13, padding: '8px 20px',
        borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)',
        background: '#fff', color: '#3a2a18', cursor: 'pointer',
        transition: 'background 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
      >
        点击重试
      </button>
    </div>
  );
}
