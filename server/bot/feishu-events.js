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

// 妙记↔会议时间窗（与 withMatchedMinute 共用·正反向对称：卡片 received_at 落在 meeting.end_time 的 [-5min,+6h]）。
const MINUTE_MATCH_BEFORE_MS = 5 * 60 * 1000;
const MINUTE_MATCH_AFTER_MS = 6 * 60 * 60 * 1000;

// 反查「当前确实会被 withMatchedMinute 判为匹配此 minute_token」的会议。
// 候选集 = bound/topic/时间窗 三规则并集（粗筛），再用 withMatchedMinute 自身做权威过滤 → 不会和正向匹配漂移。
function meetingsMatchedToMinuteToken(minuteToken) {
  const token = String(minuteToken || '').trim();
  if (!token) return [];
  const card = getMinuteCard(token);
  const rows = db.prepare(`
    SELECT DISTINCT m.*
    FROM feishu_meetings m
    WHERE m.bound_minute_token = @token
       OR (m.bound_minute_token IS NULL AND @topic IS NOT NULL AND m.topic = @topic)
       OR (
         m.bound_minute_token IS NULL
         AND @receivedAt IS NOT NULL
         AND m.end_time IS NOT NULL
         AND @receivedAt >= m.end_time - @beforeMs
         AND @receivedAt <= m.end_time + @afterMs
       )
  `).all({
    token,
    topic: card?.topic || null,
    receivedAt: Number.isFinite(Number(card?.received_at)) ? Number(card.received_at) : null,
    beforeMs: MINUTE_MATCH_BEFORE_MS,
    afterMs: MINUTE_MATCH_AFTER_MS,
  });
  return rows.filter((meeting) => withMatchedMinute(meeting).minute_token === token);
}

// 某 minute_token 若已有总结 → 给指定会议补一条 summary_ready（覆盖「先总结妙记、后绑定会议」）。
function appendSummaryReadyEventIfPresent(meetingId, minuteToken, fallbackOccurredAt) {
  try {
    if (!meetingId || !minuteToken) return;
    const row = db.prepare('SELECT generated_at FROM feishu_meeting_summaries WHERE minute_token=?').get(minuteToken);
    if (row) appendMeetingEvent('summary_ready', meetingId, row.generated_at || fallbackOccurredAt);
  } catch (e) { console.warn('[feishu-events] appendSummaryReadyEventIfPresent:', e.message); }
}

// 卡片到来 → 对「当前匹配此卡片 token」的会议发 minute_bound（显式绑定的会议由 bindMinuteToMeeting 自己发，跳过）。
function appendMinuteBoundEventsForCard(minuteToken, occurredAt) {
  try {
    for (const meeting of meetingsMatchedToMinuteToken(minuteToken)) {
      if (meeting.bound_minute_token) continue;
      appendMeetingEvent('minute_bound', meeting.meeting_id, occurredAt);
      appendSummaryReadyEventIfPresent(meeting.meeting_id, minuteToken, occurredAt);
    }
  } catch (e) { console.warn('[feishu-events] appendMinuteBoundEventsForCard:', e.message); }
}

// 总结生成 → 对所有匹配此 token 的会议发 summary_ready。
function appendSummaryReadyEventsForMinute(minuteToken, generatedAt) {
  try {
    for (const meeting of meetingsMatchedToMinuteToken(minuteToken)) {
      appendMeetingEvent('summary_ready', meeting.meeting_id, generatedAt);
    }
  } catch (e) { console.warn('[feishu-events] appendSummaryReadyEventsForMinute:', e.message); }
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
    const receivedAt = toMs(message.create_time) || Date.now();
    db.prepare(`
      INSERT INTO feishu_minute_cards (minute_token, minute_url, topic, chat_id, received_at)
      VALUES (@token, @url, @topic, @chat, @recv)
      ON CONFLICT(minute_token) DO UPDATE SET
        minute_url=@url, topic=COALESCE(@topic, topic), chat_id=COALESCE(@chat, chat_id)
    `).run({
      token: minuteToken, url: minuteUrl, topic,
      chat: message.chat_id || null,
      recv: receivedAt,
    });
    // 卡片落库后，对当前匹配此 token 的会议补发 minute_bound（occurred_at 用库里 received_at·重放幂等）。
    const card = getMinuteCard(minuteToken);
    appendMinuteBoundEventsForCard(minuteToken, card?.received_at || receivedAt);
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
    const summaryJson = JSON.stringify(result.summary);
    const usageJson = JSON.stringify(result.usage || {});
    const generatedAt = Date.now();
    const prev = db.prepare('SELECT summary_json FROM feishu_meeting_summaries WHERE minute_token=?').get(result.minuteToken);
    const summaryChanged = !prev || prev.summary_json !== summaryJson;
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
      summary: summaryJson,
      model: model || 'unknown',
      usage: usageJson,
      at: generatedAt,
      by: generatedByOpenId || '',
    });
    // 总结内容真变（首次或重生成出不同结果）才 emit；force regenerate 出同样内容不打扰设备。
    if (summaryChanged) appendSummaryReadyEventsForMinute(result.minuteToken, generatedAt);
  } catch (e) { console.warn('[feishu-events] upsertMeetingSummary:', e.message); }
}

// 取某会议的总结。status: not_found / missing_minute / not_generated / ready。
// 先按 meeting_id 直查（总结落库时存了 meeting_id）——不依赖 minute_token 的 heuristic 重新匹配，
// 防「妙记匹配后来漂移（又来张同 topic 新卡片）→ 设备拉不到原总结」。命中即 ready；否则回退 minute_token。
export function getMeetingSummaryForMeeting(meetingId) {
  const meeting = getMeeting(meetingId);
  if (!meeting) return { status: 'not_found', meeting: null, summary: null };
  const byMeeting = db.prepare('SELECT * FROM feishu_meeting_summaries WHERE meeting_id=? ORDER BY generated_at DESC LIMIT 1').get(meetingId);
  if (byMeeting) return { status: 'ready', meeting, summary: { ...byMeeting, summary: JSON.parse(byMeeting.summary_json) } };
  // 回退：按当前匹配的 minute_token 查（覆盖 meeting_id 列为 null 的旧总结 / 直查未命中）。
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
  const row = db.prepare('SELECT meeting_id, bound_minute_token FROM feishu_meetings WHERE meeting_id=?').get(meetingId);
  if (!row) return null;
  if (row.bound_minute_token === token) return getMeeting(meetingId); // 同 token 重复绑定：不刷新 bound_at、不重复发事件。
  const boundAt = Date.now();
  db.prepare(`
    UPDATE feishu_meetings
    SET bound_minute_token=@token, bound_minute_source=@matchedBy, bound_minute_by=@boundBy,
        bound_minute_at=@boundAt, updated_at=datetime('now')
    WHERE meeting_id=@meetingId
  `).run({
    meetingId, token,
    matchedBy: String(matchedBy || 'inkloop_confirmation').slice(0, 64),
    boundBy: String(boundBy || 'inkloop').slice(0, 128),
    boundAt,
  });
  appendMeetingEvent('minute_bound', meetingId, boundAt);
  appendSummaryReadyEventIfPresent(meetingId, token, boundAt); // 若该 token 已先有总结，补发 summary_ready。
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
      .get(meeting.end_time - MINUTE_MATCH_BEFORE_MS, meeting.end_time + MINUTE_MATCH_AFTER_MS);
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
