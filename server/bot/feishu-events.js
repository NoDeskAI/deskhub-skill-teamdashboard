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

// 追加可重放事件（L1·游标 seq 自增；同 (type,meeting_id) 幂等更新 occurred_at）。
// occurred_at NOT NULL → toMs 可能为 null（事件没带 start/end）时用落库时刻兜底。
function appendMeetingEvent(type, meetingId, occurredAt) {
  try {
    const at = Number.isFinite(Number(occurredAt)) ? Math.round(Number(occurredAt)) : null;
    // 同一 (type,meeting_id) 时间没变 → 不重复追加（去重）；时间变（会议重开 started / 补正 start_time）→ 追加新 seq 让设备增量感知。
    const last = db.prepare('SELECT occurred_at FROM feishu_meeting_events WHERE type=? AND meeting_id=? ORDER BY seq DESC LIMIT 1').get(type, meetingId);
    if (last && (at == null || last.occurred_at === at)) return;
    const now = Date.now();
    db.prepare(`
      INSERT INTO feishu_meeting_events (type, meeting_id, occurred_at, created_at)
      VALUES (@type, @meetingId, @occurredAt, @now)
      ON CONFLICT(type, meeting_id, occurred_at) DO NOTHING
    `).run({ type, meetingId, occurredAt: at ?? now, now });
  } catch (e) { console.warn('[feishu-events] appendMeetingEvent:', e.message); }
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
        meeting_no=COALESCE(@no, meeting_no), topic=COALESCE(@topic, topic), start_time=COALESCE(@start, start_time),
        owner_open_id=COALESCE(@owner, owner_open_id), group_ids=COALESCE(@groups, group_ids),
        updated_at=datetime('now')
    `).run({
      id: m.id, no: m.meeting_no || null, topic: m.topic || null,
      start: toMs(m.start_time), end: toMs(m.end_time),
      owner: m.owner?.id?.open_id || m.host_user?.id?.open_id || null,
      groups: m.security_setting?.group_ids ? JSON.stringify(m.security_setting.group_ids) : null,
    });
    appendMeetingEvent('started', m.id, toMs(m.start_time));
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
        meeting_no=COALESCE(@no, meeting_no), topic=COALESCE(@topic, topic),
        start_time=COALESCE(@start, start_time), end_time=COALESCE(@end, end_time),
        owner_open_id=COALESCE(@owner, owner_open_id), group_ids=COALESCE(@groups, group_ids),
        updated_at=datetime('now')
    `).run({
      id: m.id, no: m.meeting_no || null, topic: m.topic || null,
      start: toMs(m.start_time), end: toMs(m.end_time),
      owner: m.owner?.id?.open_id || m.host_user?.id?.open_id || null,
      groups: m.security_setting?.group_ids ? JSON.stringify(m.security_setting.group_ids) : null,
    });
    appendMeetingEvent('ended', m.id, toMs(m.end_time));
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

// L1：增量事件流（设备 GET /meetings/events?since=<seq>）。每条 event 内嵌完整会议（带 match）。
export function meetingEventsSince(since = 0, limit = 100) {
  const rows = db.prepare(`
    SELECT e.seq, e.type AS event_type, e.occurred_at AS event_occurred_at,
           e.created_at AS event_created_at, m.*
    FROM feishu_meeting_events e
    JOIN feishu_meetings m ON m.meeting_id = e.meeting_id
    WHERE e.seq > @since
    ORDER BY e.seq ASC
    LIMIT @limit
  `).all({ since, limit });
  return {
    cursor: rows.at(-1)?.seq ?? since,
    events: rows.map(({ seq, event_type, event_occurred_at, event_created_at, ...meeting }) => ({
      seq,
      type: event_type,
      occurred_at: event_occurred_at,
      created_at: event_created_at,
      meeting: withMatchedMinute(meeting),
    })),
  };
}

// L1：当前进行中的会议快照（设备无 cursor / 迟到打开时补 active）。end_time 仍空且 12h 内开始。
export function activeMeetings(limit = 20) {
  const floor = Date.now() - 12 * 60 * 60 * 1000;
  return db.prepare(`
    SELECT * FROM feishu_meetings
    WHERE start_time IS NOT NULL AND start_time >= ? AND end_time IS NULL
    ORDER BY start_time DESC
    LIMIT ?
  `).all(floor, limit).map(withMatchedMinute);
}

// ── L5：会议五要素总结落库 / 取数（供设备会后 recap 显示「会议讲了什么」）──
// 按 minute_token 主键（总结绑定妙记转写）；result 来自 meeting-workflow.summarizeMeeting：{ minuteToken, meetingId, topic, summary, usage }。
export function upsertMeetingSummary(result, { model, generatedByOpenId = '' } = {}) {
  if (!result?.minuteToken) { console.warn('[feishu-events] upsertMeetingSummary: 缺 minuteToken，跳过落库'); return; }
  try {
    db.prepare(`
      INSERT INTO feishu_meeting_summaries
        (minute_token, meeting_id, topic, summary_json, model, usage_json, generated_at, generated_by_open_id)
      VALUES (@minuteToken, @meetingId, @topic, @summary, @model, @usage, @at, @by)
      ON CONFLICT(minute_token) DO UPDATE SET
        meeting_id=COALESCE(@meetingId, meeting_id),
        topic=COALESCE(NULLIF(@topic, ''), topic),
        summary_json=@summary, model=@model, usage_json=@usage,
        generated_at=@at, generated_by_open_id=@by, updated_at=datetime('now')
    `).run({
      minuteToken: result.minuteToken,
      meetingId: result.meetingId || null,
      topic: result.topic || '',
      summary: JSON.stringify(result.summary),
      model: model || 'unknown',
      usage: JSON.stringify(result.usage || {}),
      at: Date.now(),
      by: generatedByOpenId || '',
    });
  } catch (e) { console.warn('[feishu-events] upsertMeetingSummary:', e.message); }
}

// 取某会议的总结：meeting_id → minute_token → summary。status: not_found / missing_minute / not_generated / ready。
export function getMeetingSummaryForMeeting(meetingId) {
  const meeting = getMeeting(meetingId);
  if (!meeting) return { status: 'not_found', meeting: null, summary: null };
  if (!meeting.minute_token) return { status: 'missing_minute', meeting, summary: null };
  const row = db.prepare('SELECT * FROM feishu_meeting_summaries WHERE minute_token=?').get(meeting.minute_token);
  return {
    status: row ? 'ready' : 'not_generated',
    meeting,
    summary: row ? { ...row, summary: JSON.parse(row.summary_json) } : null,
  };
}

export function recentMinuteCards(limit = 20) {
  return db.prepare('SELECT * FROM feishu_minute_cards ORDER BY received_at DESC LIMIT ?').all(limit);
}

export function getMinuteCard(minuteToken) {
  if (!minuteToken) return null;
  return db.prepare('SELECT * FROM feishu_minute_cards WHERE minute_token=?').get(minuteToken) || null;
}

// InkLoop/人工确认后把某 minute_token 显式绑定给某会议（覆盖 topic/时间窗启发式匹配）
export function bindMinuteToMeeting(meetingId, minuteToken, { matchedBy = 'inkloop_confirmation', boundBy = 'inkloop' } = {}) {
  const token = String(minuteToken || '').trim();
  if (!/^[A-Za-z0-9_-]+$/.test(token)) { const e = new Error('invalid minute_token'); e.code = 'INVALID_MINUTE_TOKEN'; throw e; }
  const row = db.prepare('SELECT meeting_id FROM feishu_meetings WHERE meeting_id=?').get(meetingId);
  if (!row) return null;
  db.prepare(`
    UPDATE feishu_meetings
    SET bound_minute_token=@token, bound_minute_source=@matchedBy, bound_minute_by=@boundBy,
        bound_minute_at=@boundAt, updated_at=datetime('now')
    WHERE meeting_id=@meetingId
  `).run({
    meetingId, token,
    matchedBy: String(matchedBy || 'inkloop_confirmation').slice(0, 64),
    boundBy: String(boundBy || 'inkloop').slice(0, 128),
    boundAt: Date.now(),
  });
  return getMeeting(meetingId);
}

// 给一条会议挂上妙记：显式绑定优先；topic/时间窗只标 heuristic，并把 match 元信息透给 InkLoop。
function withMatchedMinute(meeting) {
  if (meeting.bound_minute_token) {
    const boundCard = getMinuteCard(meeting.bound_minute_token);
    return serializeMeeting(meeting, boundCard, {
      minute_token: meeting.bound_minute_token,
      confidence: 'exact', source: 'explicit',
      matched_by: meeting.bound_minute_source || 'bound_minute_token',
    });
  }
  let card = null;
  let match = { minute_token: null, confidence: 'none', source: null, matched_by: null };
  if (meeting.topic) {
    card = db.prepare('SELECT * FROM feishu_minute_cards WHERE topic=? ORDER BY received_at DESC LIMIT 1').get(meeting.topic);
    if (card) match = { minute_token: card.minute_token, confidence: 'heuristic', source: 'topic', matched_by: 'topic_exact_high' };
  }
  if (!card && meeting.end_time) {
    card = db.prepare('SELECT * FROM feishu_minute_cards WHERE received_at >= ? AND received_at <= ? ORDER BY received_at ASC LIMIT 1')
      .get(meeting.end_time - 5 * 60 * 1000, meeting.end_time + 6 * 60 * 60 * 1000);
    if (card) match = { minute_token: card.minute_token, confidence: 'heuristic', source: 'time_window', matched_by: 'end_time_window_low' };
  }
  return serializeMeeting(meeting, card, match);
}

function fallbackMinuteUrl(token) {
  const base = (process.env.FEISHU_MINUTE_BASE_URL || 'https://www.feishu.cn').replace(/\/$/, '');
  return token ? `${base}/minutes/${encodeURIComponent(token)}` : null;
}

function serializeMeeting(meeting, card, match) {
  return {
    ...meeting,
    group_ids: safeJson(meeting.group_ids),
    minute_token: match.minute_token,
    // 显式绑定的 token 可能不在 minute_cards（无 url）→ 给可配 fallback，让端侧/卡片仍能打开妙记
    minute_url: card?.minute_url || (match.source === 'explicit' ? fallbackMinuteUrl(match.minute_token) : null),
    match,
  };
}

function safeJson(s) { try { return s ? JSON.parse(s) : []; } catch { return []; } }
