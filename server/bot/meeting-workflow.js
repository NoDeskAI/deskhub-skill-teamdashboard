/**
 * 会议总结链路（WS2·会后「开完会秒得总结卡」）
 *
 * meeting_id / minute_token / 最近会议 → 妙记 transcript → MiniMax-M3 非流式总结五要素 → 飞书 CardKit 卡片。
 * 刻意不走 chat()：不进会话历史、不走工具循环、不受轮次裁剪；M3 百万上下文一次读完整场转写、不分片。
 * 触发：① IM 命令「总结会议 X / 总结最近会议」(index.js handleMessage) ② 会议结束自动(默认关·BOT_MEETING_SUMMARY_AUTO)。
 */
import { client, MEETING_MODEL } from './anthropic-client.js';
import { getMeeting, getMinuteCard, recentMeetings, upsertMeetingSummary } from './feishu-events.js';
import { getMinute, getTranscript, soleAuthorizedOpenId } from './feishu-minutes.js';
import { createAndSendCard } from './feishu.js';
import { buildMeetingSummaryCard } from './card-templates.js';

const MEETING_MAX_TOKENS = Number(process.env.MINIMAX_MEETING_MAX_TOKENS) || 12000;      // 输出上限，不限输入
// ⚠️ MiniMax：不传 thinking 会退化到 OpenAI 兼容模式、只返 reasoning_content 不返 text（见 summary-model.js 注释）
//    → 会议总结必须开 thinking，否则 text block 全空、总结直接失败。默认 2000，设 0 关需自担风险。
const MEETING_THINKING_BUDGET = Number(process.env.MINIMAX_MEETING_THINKING_BUDGET ?? 2000);
const TRANSCRIPT_FORMAT = process.env.FEISHU_MEETING_TRANSCRIPT_FORMAT || 'srt';
const TOKEN_RE = /^[A-Za-z0-9_-]{3,256}$/;

const SYSTEM_PROMPT = `你是会议纪要助手。基于完整 transcript 输出严格 JSON，不要 Markdown、不要代码块、不要解释。
JSON schema:
{
  "conclusions": ["结论，必须来自 transcript"],
  "action_items": [{"task":"行动项","owner":"责任人，未知填未指定","due":"期限，未知留空","evidence":"原话依据摘要"}],
  "risks": ["风险或阻塞"],
  "open_questions": ["待决问题"],
  "next_steps": ["后续建议"]
}
要求：不编造未出现的信息；责任人只在有人明确承诺/被明确指派时才填具体人，否则填"未指定"；保留具体名词、数字、日期；transcript 再长也一次性整体理解，不分片。`;

/** 识别会议总结命令：返回 {recent} / {meetingId} / {minuteToken}；非命令或参数不像 id/token 返回 null（不误拦正常聊天）。 */
export function parseMeetingSummaryCommand(text) {
  const t = String(text || '').trim();
  if (/^\/?(?:总结最近(?:的)?会议|总结最近|总结刚才(?:的)?会议?|最近会议总结)$/.test(t)) return { recent: true };
  const cmd = t.match(/^(\/?会议总结|总结会议|总结妙记|整理会议|会议纪要)\s+(\S+)$/);
  if (!cmd) return null;
  const verb = cmd[1];
  const arg = cmd[2].trim();
  const urlToken = arg.match(/\/minutes\/([A-Za-z0-9_-]+)/)?.[1];
  if (urlToken) return { minuteToken: urlToken };
  if (!TOKEN_RE.test(arg)) return null; // 「会议纪要 怎么写」这类 → 不拦，落普通聊天
  if (/妙记/.test(verb)) return { minuteToken: arg };
  return { meetingId: arg };
}

async function getMeetingTranscript({ meetingId, minuteToken, recent, requesterOpenId }) {
  let meeting = null;
  let card = null;

  if (recent) {
    meeting = recentMeetings(20).find((x) => x.minute_token) || null;
    if (!meeting) throw new Error('最近没有已关联妙记的会议（妙记卡片可能还没转发给机器人）。');
    minuteToken = meeting.minute_token;
  } else if (meetingId) {
    meeting = getMeeting(meetingId);
    if (!meeting) throw new Error(`找不到会议：${meetingId}`);
    minuteToken = minuteToken || meeting.minute_token;
  }
  if (minuteToken) card = getMinuteCard(minuteToken);
  if (!minuteToken) throw new Error('找不到关联的妙记。请先把妙记卡片转发给机器人，或直接发妙记链接/token。');

  // 多个授权用户都试一遍：owner 有 open_id 但没 OAuth 时，回退到 requester / 唯一授权用户
  const openIds = [...new Set([meeting?.owner_open_id, requesterOpenId, soleAuthorizedOpenId()].filter(Boolean).map(String))];
  if (!openIds.length) throw new Error('没有可用的飞书授权用户，需妙记 owner 先完成 OAuth 授权。');

  let minute = null;
  let transcript = '';
  let lastErr = null;
  for (const oid of openIds) {
    try {
      try { minute = await getMinute(minuteToken, oid); } catch (e) { console.warn('[MeetingSummary] minute meta skipped:', e.message); }
      transcript = await getTranscript(minuteToken, oid, TRANSCRIPT_FORMAT);
      if (transcript && transcript.trim()) break;
    } catch (e) {
      lastErr = e;
      console.warn('[MeetingSummary] transcript read failed, trying next authorized user:', e.message);
    }
  }
  if ((!transcript || !transcript.trim()) && lastErr) throw lastErr;
  if (!transcript || !transcript.trim()) throw new Error('妙记转写为空（可能还在生成中）。');
  return {
    meetingId: meeting?.meeting_id || meetingId || null,
    minuteToken,
    minuteUrl: meeting?.minute_url || card?.minute_url || '',
    topic: meeting?.topic || card?.topic || minute?.minute?.topic || minute?.topic || '',
    transcript,
  };
}

// 从输出里抠第一个完整 JSON 对象（先剥代码块标记；栈匹配花括号、忽略字符串内括号）
function extractJsonObject(text) {
  const s = String(text || '').replace(/```(?:json)?/gi, '');
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (inStr) { if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return s.slice(start, i + 1);
  }
  return null;
}

function assertSummaryShape(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('会议总结 JSON 非对象');
  for (const k of ['conclusions', 'action_items', 'risks', 'open_questions', 'next_steps']) {
    if (!Array.isArray(raw[k])) throw new Error(`会议总结 JSON 缺数组字段：${k}`);
  }
}

const asList = (v) => Array.isArray(v)
  ? v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).filter(Boolean)
  : (typeof v === 'string' && v.trim() ? [v.trim()] : []);

function normalizeSummary(raw) {
  return {
    conclusions: asList(raw.conclusions),
    action_items: Array.isArray(raw.action_items) ? raw.action_items.map((x) => ({
      task: String(x.task || '').trim(),
      owner: String(x.owner || x.assignee || '未指定').trim() || '未指定',
      due: String(x.due || '').trim(),
      evidence: String(x.evidence || '').trim(),
    })).filter((x) => x.task) : [],
    risks: asList(raw.risks),
    open_questions: asList(raw.open_questions),
    next_steps: asList(raw.next_steps),
  };
}

/** 取数 → M3 非流式总结 → 解析五要素。返回 { ...source, summary, usage }。 */
export async function summarizeMeeting(input) {
  const source = await getMeetingTranscript(input);
  const body = {
    model: MEETING_MODEL,
    max_tokens: MEETING_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: `会议：${source.topic || source.meetingId || source.minuteToken}` },
        // 多模态预留：将来端侧传手写圈画截图，在此插入 { type:'image', source:{...} } block。
        { type: 'text', text: `<transcript>\n${source.transcript}\n</transcript>` },
      ],
    }],
  };
  if (MEETING_THINKING_BUDGET > 0) {
    if (MEETING_THINKING_BUDGET >= MEETING_MAX_TOKENS) throw new Error('MINIMAX_MEETING_THINKING_BUDGET 必须小于 MINIMAX_MEETING_MAX_TOKENS');
    body.thinking = { type: 'enabled', budget_tokens: MEETING_THINKING_BUDGET };
  }
  const res = await client.messages.create(body);
  if (res.stop_reason === 'max_tokens') throw new Error('会议总结输出被截断，请调大 MINIMAX_MEETING_MAX_TOKENS');
  const rawText = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text || '').join('\n');
  const json = extractJsonObject(rawText);
  if (!json) throw new Error('会议总结模型未返回可解析的 JSON');
  let parsed;
  try { parsed = JSON.parse(json); } catch { throw new Error('会议总结 JSON 解析失败'); }
  assertSummaryShape(parsed);
  return { ...source, summary: normalizeSummary(parsed), usage: res.usage };
}

/** 总结 + 落库（IM 命令、自动总结、设备 POST 三条触发都走这个，确保设备能 GET 到·L5）。 */
export async function summarizeAndPersistMeeting(input) {
  const result = await summarizeMeeting(input);
  upsertMeetingSummary(result, { model: MEETING_MODEL, generatedByOpenId: input.requesterOpenId || '' });
  return result;
}

/** 总结并发卡片到 receiveId；发送失败抛错（让调用方发错误反馈，不静默丢）。 */
export async function summarizeAndSendMeeting({ receiveId, receiveIdType, ...input }) {
  const result = await summarizeAndPersistMeeting(input);
  const card = buildMeetingSummaryCard(result.summary, result);
  if (receiveId && receiveIdType) {
    const sent = await createAndSendCard(receiveId, receiveIdType, card);
    if (!sent?.messageId) throw new Error('会议总结卡片发送失败');
  }
  return result;
}

/** 会议结束事件自动总结（默认关·BOT_MEETING_SUMMARY_AUTO=true 开；推送 FEISHU_MEETING_SUMMARY_CHAT_ID 或 owner）。 */
export async function summarizeMeetingEndedEvent(data) {
  const m = data?.meeting;
  if (!m?.id) return null;
  const ownerOpenId = m.owner?.id?.open_id || m.host_user?.id?.open_id || null;
  const receiveId = process.env.FEISHU_MEETING_SUMMARY_CHAT_ID || ownerOpenId;
  const receiveIdType = process.env.FEISHU_MEETING_SUMMARY_CHAT_ID ? 'chat_id' : 'open_id';
  if (!receiveId) { console.warn('[MeetingSummary] 自动总结缺推送目标'); return null; }
  return summarizeAndSendMeeting({ meetingId: m.id, requesterOpenId: ownerOpenId, receiveId, receiveIdType });
}
