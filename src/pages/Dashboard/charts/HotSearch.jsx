import { FONT_MONO, FONT_SANS } from "../../../constants/theme.js";

// 事件名 → 中文映射
const EVENT_LABELS = {
  skill_detail_view: '技能详情查看',
  scene_view: '场景浏览',
  skill_card_click: '技能卡片点击',
  search_query: '搜索',
  header_search: '顶部搜索',
  skill_download: '技能下载',
  role_view: '角色浏览',
  auth_login_success: '登录成功',
  auth_oauth_callback: 'OAuth 回调',
  auth_oauth_start: 'OAuth 发起',
  auth_phone_submit: '手机号提交',
  auth_code_submit: '验证码提交',
  skill_star: '技能收藏',
  keeper_submit: 'Keeper 提交',
  keeper_tab_switch: 'Keeper 切换',
  keeper_explain_success: 'Keeper 解析',
  publish_success: '发布成功',
  publish_error: '发布失败',
  publish_upload_done: '发布上传完成',
  publish_files_selected: '发布选择文件',
};

/**
 * @param {{ searches?: Array<{ term: string, count: number }>, topSkills?: Array<{ name: string, dl: number }> }} props
 * searches 接收 Umami 事件排行数据 [{ term: "skill_detail_view", count: 4055 }, ...]
 */
export default function HotSearch({ searches, topSkills }) {
  const hasReal = searches && searches.length > 0;
  const data = hasReal ? searches : [];

  // topSkills 从 Dashboard 传入
  const skills = topSkills && topSkills.length > 0 ? topSkills : [];
  const maxCount = data[0]?.count || 1;

  if (!hasReal && skills.length === 0) {
    return <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 40 }}>暂无数据</div>;
  }

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", gap: 24 }}>
      {/* 热门行为 */}
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#7a6a55", marginBottom: 8 }}>
          {hasReal ? '用户行为 Top 10' : '暂无行为数据'}
        </div>
        {hasReal && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {data.map((s, i) => (
              <div key={s.term} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontFamily: FONT_MONO, fontSize: 11, color: i < 3 ? "#b85c1a" : "#a09888",
                  width: 18, textAlign: "right", fontWeight: i < 3 ? 600 : 400,
                }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, position: "relative", height: 20, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    position: "absolute", top: 0, left: 0, bottom: 0,
                    width: `${(s.count / maxCount) * 100}%`,
                    background: i < 3 ? "rgba(184,92,26,0.15)" : "rgba(0,0,0,0.04)",
                    borderRadius: 4,
                    transition: "width 0.6s cubic-bezier(0.25, 1, 0.5, 1)",
                  }} />
                  <div style={{
                    position: "relative", zIndex: 1,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "0 8px", height: 20,
                  }}>
                    <span style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#4a4540" }}>
                      {EVENT_LABELS[s.term] || s.term}
                    </span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: "#a09888" }}>{s.count.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 热门技能 */}
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: "#7a6a55", marginBottom: 8 }}>热门技能 Top 5</div>
        {skills.length === 0
          ? <div style={{ color: '#aaa', fontSize: 13 }}>暂无数据</div>
          : skills.map((s, i) => (
            <div key={s.name} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.04)",
            }}>
              <span style={{
                fontFamily: FONT_MONO, fontSize: 16, fontWeight: 600,
                color: i === 0 ? "#8a6a3a" : i < 3 ? "#7a6a55" : "#a09888",
                width: 20, textAlign: "center",
              }}>
                {i + 1}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FONT_SANS, fontSize: 13, color: "#3a2a18" }}>{s.name}</div>
                <div style={{ fontFamily: FONT_SANS, fontSize: 11, color: "#a09888" }}>
                  {s.dl} 下载
                </div>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}
