/**
 * 飞书会议事件中枢（WS2·供 InkLoop 对轴拿 t0 + minute_token）
 *
 * - 会议：VC all_meeting_started/ended 事件落库（无须机器人参会即触发）
 * - 妙记卡片：owner 手动转发到机器人群的「会议录制已完成」interactive 卡片 → 提 minute_token
 * - minute_token ↔ meeting_id 无直达 API → 查询时用 topic + 时间窗近似关联
 */
import db from '../db/init.js';

// VC 事件给的 start_time 是 Unix 秒（10 位）；im 消息给的是毫秒（13 位）。统一成 epoch ms。
function toMs(v) {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n < 1e12 ? Math.round(n * 1000) : Math.round(n);
}

// ── 会议落库 ──
export function recordMeetingStarted(ev) {
  const m = ev?.meeting;
  if (!m?.id) return;
  try {
    db.prepare(`
      INSERT INTO feishu_meetings (meeting_id, meeting_no, topic, start_time, end_time, owner_open_id, group_ids, updated_at)
      VALUES (@id, @no, @topic, @start, @end, @owner, @groups, datetime('now'))
      ON CONFLICT(meeting_id) DO UPDATE SET
        meeting_no=@no, topic=@topic, start_time=COALESCE(@start, start_time),
        owner_open_id=COALESCE(@owner, owner_open_id), group_ids=COALESCE(@groups, group_ids),
        updated_at=datetime('now')
    `).run({
      id: m.id, no: m.meeting_no || null, topic: m.topic || null,
      start: toMs(m.start_time), end: toMs(m.end_time),
      owner: m.owner?.id?.open_id || m.host_user?.id?.open_id || null,
      groups: m.security_setting?.group_ids ? JSON.stringify(m.security_setting.group_ids) : null,
    });
  } catch (e) { console.warn('[feishu-events] recordMeetingStarted:', e.message); }
}

export function recordMeetingEnded(ev) {
  const m = ev?.meeting;
  if (!m?.id) return;
  try {
    db.prepare(`
      INSERT INTO feishu_meetings (meeting_id, meeting_no, topic, start_time, end_time, owner_open_id, group_ids, updated_at)
      VALUES (@id, @no, @topic, @start, @end, @owner, @groups, datetime('now'))
      ON CONFLICT(meeting_id) DO UPDATE SET
        end_time=COALESCE(@end, end_time), updated_at=datetime('now')
    `).run({
      id: m.id, no: m.meeting_no || null, topic: m.topic || null,
      start: toMs(m.start_time), end: toMs(m.end_time),
      owner: m.owner?.id?.open_id || m.host_user?.id?.open_id || null,
      groups: m.security_setting?.group_ids ? JSON.stringify(m.security_setting.group_ids) : null,
    });
  } catch (e) { console.warn('[feishu-events] recordMeetingEnded:', e.message); }
}

// ── 从 interactive 妙记卡片消息提 minute_token 并落库 ──
// 卡片 content 是 JSON，内含 markdown/href，形如 https://*.feishu.cn/minutes/<token>
export function recordMinuteCardFromMessage(message) {
  try {
    const raw = message?.content;
    if (!raw || typeof raw !== 'string') return null;
    const mUrl = raw.match(/https?:\/\/[^/\s"\\]+\/minutes\/([A-Za-z0-9_-]+)/);
    if (!mUrl) return null;
    const minuteToken = mUrl[1];
    const minuteUrl = mUrl[0];
    // 标题：卡片里常见「主题：XXX」
    const mTopic = raw.match(/主题[：:]\s*([^"\\\n]+?)["\\]/) || raw.match(/主题[：:]\s*([^"\\\n]+)/);
    const topic = mTopic ? mTopic[1].trim() : null;
    db.prepare(`
      INSERT INTO feishu_minute_cards (minute_token, minute_url, topic, chat_id, received_at)
      VALUES (@token, @url, @topic, @chat, @recv)
      ON CONFLICT(minute_token) DO UPDATE SET
        minute_url=@url, topic=COALESCE(@topic, topic), chat_id=COALESCE(@chat, chat_id)
    `).run({
      token: minuteToken, url: minuteUrl, topic,
      chat: message.chat_id || null,
      recv: toMs(message.create_time) || Date.now(),
    });
    return { minuteToken, topic };
  } catch (e) { console.warn('[feishu-events] recordMinuteCard:', e.message); return null; }
}

// ── 查询（供 InkLoop 路由）──
export function recentMeetings(limit = 20) {
  const rows = db.prepare('SELECT * FROM feishu_meetings ORDER BY start_time DESC LIMIT ?').all(limit);
  return rows.map(withMatchedMinute);
}

export function getMeeting(meetingId) {
  const row = db.prepare('SELECT * FROM feishu_meetings WHERE meeting_id=?').get(meetingId);
  return row ? withMatchedMinute(row) : null;
}

export function recentMinuteCards(limit = 20) {
  return db.prepare('SELECT * FROM feishu_minute_cards ORDER BY received_at DESC LIMIT ?').all(limit);
}

// 给一条会议挂上「最可能的」妙记：同 topic 优先，否则会议结束后 6h 内最近收到的卡片
function withMatchedMinute(meeting) {
  let card = null;
  if (meeting.topic) {
    card = db.prepare('SELECT * FROM feishu_minute_cards WHERE topic=? ORDER BY received_at DESC LIMIT 1').get(meeting.topic);
  }
  if (!card && meeting.end_time) {
    card = db.prepare('SELECT * FROM feishu_minute_cards WHERE received_at >= ? AND received_at <= ? ORDER BY received_at ASC LIMIT 1')
      .get(meeting.end_time - 5 * 60 * 1000, meeting.end_time + 6 * 60 * 60 * 1000);
  }
  return {
    ...meeting,
    group_ids: safeJson(meeting.group_ids),
    minute_token: card?.minute_token || null,
    minute_url: card?.minute_url || null,
  };
}

function safeJson(s) { try { return s ? JSON.parse(s) : []; } catch { return []; } }
