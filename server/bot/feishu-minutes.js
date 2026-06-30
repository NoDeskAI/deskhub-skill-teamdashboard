/**
 * 飞书妙记 OAuth + Minutes 取数核心（WS2·InkLoop 会议转写对轴用）
 *
 * 背景：妙记 transcript 是对象级 ACL，应用 tenant_access_token 一律 403（已验证）；
 * 唯一合法路径 = 妙记 owner 用户走 OAuth 授权后，用其 user_access_token 调 minutes API。
 * 飞书新旧两套 OAuth 流，本模块走【旧版 v1】（与 lark SDK 的 authen wrapper 配套·不混用）：
 *   - 授权 URL：/open-apis/authen/v1/index?app_id=&redirect_uri=&state=   （手拼）
 *   - 换 token： client.authen.accessToken.create({grant_type:'authorization_code', code})  → /authen/v1/access_token
 *   - 续期：     client.authen.refreshAccessToken.create({grant_type:'refresh_token', refresh_token}) → /authen/v1/refresh_access_token
 * v1 响应原生带 refresh_token / refresh_expires_in，无需 offline_access（已开通无妨）。
 *
 * token 密文存储（AES-256-GCM）。panel 单实例，state 走内存 Map。
 */
import * as lark from '@larksuiteoapi/node-sdk';
import crypto from 'crypto';
import db from '../db/init.js';

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
// 回调地址：必须与飞书后台「安全设置 > 重定向 URL」字节级一致
const REDIRECT_URI = process.env.FEISHU_REDIRECT_URI || 'https://nodeskweb.xiaobuyu.trade/api/feishu/oauth/callback';
const AUTH_BASE = 'https://open.feishu.cn/open-apis/authen/v1/index';

// ⚠️ 静默 lark SDK 内置 logger：它在请求失败时会打 config.data（刷新接口里正好含 refresh_token，
// tenant token 失败时含 app_secret）→ 凭据泄露进日志。换 noop logger + fatal level。
const noopLarkLogger = Object.freeze({ error() {}, warn() {}, info() {}, debug() {}, trace() {} });

// 仅用于 minutes/authen API 的 HTTP client（≠ feishu.js 里那个收消息的 WSClient，互不影响）
let _client = null;
function client() {
  if (_client) return _client;
  if (!APP_ID || !APP_SECRET) throw new Error('FEISHU_APP_ID / FEISHU_APP_SECRET 未配置');
  _client = new lark.Client({
    appId: APP_ID, appSecret: APP_SECRET, appType: lark.AppType.SelfBuild, domain: lark.Domain.Feishu,
    loggerLevel: lark.LoggerLevel.fatal, logger: noopLarkLogger,
  });
  return _client;
}

// ── token 加解密（AES-256-GCM）──
// key 优先用 env FEISHU_TOKEN_ENC_KEY(64 hex=32B)，否则从 APP_SECRET 派生（scrypt）
let _encKey = null;
function encKey() {
  if (_encKey) return _encKey;
  const hex = process.env.FEISHU_TOKEN_ENC_KEY;
  if (hex) {
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error('FEISHU_TOKEN_ENC_KEY 必须是 64 位 hex（32 字节）');
    _encKey = Buffer.from(hex, 'hex'); return _encKey;
  }
  // 未显式配 key：从 APP_SECRET 派生（当前生产即此路·换 key 会让已存 token 解不开需重授权）
  if (!APP_SECRET) throw new Error('无法派生 token 加密 key：APP_SECRET 缺失');
  _encKey = crypto.scryptSync(APP_SECRET, 'inkloop-feishu-oauth-v1', 32);
  return _encKey;
}
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}
function decrypt(blob) {
  const parts = String(blob).split(':');
  if (parts.length !== 3 || parts.some((p) => !p)) throw new Error('token 密文格式错误');
  const iv = Buffer.from(parts[0], 'base64'), tag = Buffer.from(parts[1], 'base64');
  if (iv.length !== 12 || tag.length !== 16) throw new Error('token 密文格式错误');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(parts[2], 'base64')), decipher.final()]).toString('utf8');
}

// ── CSRF state（内存·10min TTL；panel 单实例够用）──
const _states = new Map(); // state -> { createdAt, returnTo }
const STATE_TTL = 10 * 60 * 1000;
function newState(returnTo) {
  const s = crypto.randomBytes(24).toString('base64url');
  _states.set(s, { createdAt: Date.now(), returnTo: returnTo || '' });
  return s;
}
function consumeState(s) {
  const e = _states.get(s);
  if (!e) return null;
  _states.delete(s);
  if (Date.now() - e.createdAt > STATE_TTL) return null;
  return e;
}
// 定期清过期 state
setInterval(() => {
  const now = Date.now();
  for (const [s, e] of _states.entries()) if (now - e.createdAt > STATE_TTL) _states.delete(s);
}, 5 * 60 * 1000).unref?.();

// ── 授权 URL ──
export function buildAuthorizeUrl(returnTo) {
  const state = newState(returnTo);
  const u = new URL(AUTH_BASE);
  u.searchParams.set('app_id', APP_ID);
  u.searchParams.set('redirect_uri', REDIRECT_URI);
  u.searchParams.set('state', state);
  return u.toString();
}
export { consumeState };

// ── lark 响应取 code/data（SDK 默认 interceptor 只返回 data，但保险起见两手都兜）──
function ensureOk(label, res) {
  if (res && res.code !== undefined && res.code !== 0) {
    const err = new Error(`${label}: code=${res.code} msg=${res.msg || 'unknown'}`);
    err.feishuCode = res.code;
    throw err;
  }
  return res?.data ?? res;
}

// ── code 换 token + 入库 ──
export async function exchangeCodeAndStore(code) {
  const res = await client().authen.accessToken.create({ data: { grant_type: 'authorization_code', code } });
  const d = ensureOk('authen.accessToken.create', res);
  if (!d?.access_token || !d?.open_id) throw new Error('换 token 成功但缺 access_token/open_id');
  saveToken(d);
  return { open_id: d.open_id, name: d.name, scope: d.scope };
}

function saveToken(d) {
  const now = Date.now();
  db.prepare(`
    INSERT INTO feishu_user_oauth_tokens
      (open_id, union_id, user_id, name, scope, access_token_enc, refresh_token_enc, access_expires_at, refresh_expires_at, authorized_at, last_refresh_at, reauth_required, updated_at)
    VALUES (@open_id, @union_id, @user_id, @name, @scope, @at, @rt, @aexp, @rexp, datetime('now'), datetime('now'), 0, datetime('now'))
    ON CONFLICT(open_id) DO UPDATE SET
      union_id=@union_id, user_id=@user_id, name=@name, scope=@scope,
      access_token_enc=@at, refresh_token_enc=@rt,
      access_expires_at=@aexp, refresh_expires_at=@rexp,
      last_refresh_at=datetime('now'), reauth_required=0, updated_at=datetime('now')
  `).run({
    open_id: d.open_id,
    union_id: d.union_id || null,
    user_id: d.user_id || null,
    name: d.name || null,
    scope: d.scope || null,
    at: encrypt(d.access_token),
    rt: encrypt(d.refresh_token || ''),
    aexp: now + (Number(d.expires_in) || 7200) * 1000,
    rexp: now + (Number(d.refresh_expires_in) || 30 * 86400) * 1000,
  });
}

// 区分瞬时失败（网络/5xx·别误标失效）vs 永久失败（refresh_token 真过期/撤销·需重新授权）
function isPermanentRefreshFailure(e, row) {
  if (row.refresh_expires_at <= Date.now()) return true;
  if (e?.response?.status >= 500 || ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'ENOTFOUND'].includes(e?.code)) return false;
  const msg = String(e?.response?.data?.msg || e?.feishuMsg || e?.message || '').toLowerCase();
  return /refresh[_ -]?token/.test(msg) && /(invalid|expired|revoked|not found|unauthori[sz]ed)/.test(msg);
}
// 只在 refresh_token 仍是这一份时标失效（防覆盖已被别的刷新更新过的行）
function markReauthRequired(row) {
  db.prepare("UPDATE feishu_user_oauth_tokens SET reauth_required=1, updated_at=datetime('now') WHERE open_id=@open_id AND refresh_token_enc=@old_rt")
    .run({ open_id: row.open_id, old_rt: row.refresh_token_enc });
}

// ── 刷新单个 token（rolling：写回新的 access+refresh）──
async function refreshRow(row) {
  let d;
  try {
    const res = await client().authen.refreshAccessToken.create({ data: { grant_type: 'refresh_token', refresh_token: decrypt(row.refresh_token_enc) } });
    d = ensureOk('authen.refreshAccessToken.create', res);
  } catch (e) {
    if (!isPermanentRefreshFailure(e, row)) { const err = new Error('飞书 token 刷新暂时失败，请稍后重试'); err.code = 'REFRESH_TRANSIENT'; throw err; }
    markReauthRequired(row);
    const err = new Error('飞书授权已失效，需重新授权'); err.reauthRequired = true; err.code = 'REAUTH_REQUIRED'; throw err;
  }
  if (!d?.access_token) {
    markReauthRequired(row);
    const err = new Error('刷新返回缺 access_token（需重新授权）'); err.reauthRequired = true; err.code = 'REAUTH_REQUIRED'; throw err;
  }
  // 条件更新：只在 refresh_token 仍是这一份且未失效时写回（防 rolling refresh 下旧响应覆盖新 token）
  const info = db.prepare(`
    UPDATE feishu_user_oauth_tokens SET
      union_id=@union_id, user_id=@user_id, name=@name, scope=@scope,
      access_token_enc=@at, refresh_token_enc=@rt,
      access_expires_at=@aexp, refresh_expires_at=@rexp,
      last_refresh_at=datetime('now'), reauth_required=0, updated_at=datetime('now')
    WHERE open_id=@open_id AND refresh_token_enc=@old_rt AND reauth_required=0
  `).run({
    open_id: row.open_id, old_rt: row.refresh_token_enc,
    union_id: d.union_id || row.union_id || null, user_id: d.user_id || row.user_id || null,
    name: d.name || row.name || null, scope: d.scope || row.scope || null,
    at: encrypt(d.access_token), rt: d.refresh_token ? encrypt(d.refresh_token) : row.refresh_token_enc,
    aexp: Date.now() + (Number(d.expires_in) || 7200) * 1000,
    rexp: d.refresh_expires_in ? Date.now() + Number(d.refresh_expires_in) * 1000 : row.refresh_expires_at,
  });
  // 没改到行（被别的刷新抢先了）→ 回读现存的新鲜 token
  if (!info.changes) return getFreshUserAccessToken(row.open_id);
  return d.access_token;
}

// single-flight：同一 open_id 并发刷新只跑一次（懒刷新 + daemon 共用入口·防 rolling token 互相作废）
const _refreshInflight = new Map();
function refreshRowLocked(row) {
  const existing = _refreshInflight.get(row.open_id);
  if (existing) return existing;
  const p = refreshRow(row).finally(() => _refreshInflight.delete(row.open_id));
  _refreshInflight.set(row.open_id, p);
  return p;
}

// ── 拿一个新鲜的 user_access_token（懒刷新：临期 5min 内先刷）──
export async function getFreshUserAccessToken(openId) {
  const row = db.prepare('SELECT * FROM feishu_user_oauth_tokens WHERE open_id=?').get(openId);
  if (!row) { const e = new Error('该用户未授权飞书'); e.code = 'NO_TOKEN'; throw e; }
  if (row.reauth_required) { const e = new Error('该用户授权已失效，需重新授权'); e.code = 'REAUTH_REQUIRED'; throw e; }
  if (row.access_expires_at > Date.now() + 5 * 60 * 1000) return decrypt(row.access_token_enc);
  // 临期或已过期 → 刷新（single-flight）
  return refreshRowLocked(row);
}

// 单 token 场景便利：返回唯一有效 token 的 open_id（InkLoop 不传 open_id 时用）
export function soleAuthorizedOpenId() {
  const rows = db.prepare('SELECT open_id FROM feishu_user_oauth_tokens WHERE reauth_required=0').all();
  return rows.length === 1 ? rows[0].open_id : null;
}

export function listAuthorized() {
  return db.prepare('SELECT open_id, name, scope, access_expires_at, refresh_expires_at, reauth_required, authorized_at FROM feishu_user_oauth_tokens').all();
}

export function tokenStatus(openId) {
  const row = db.prepare('SELECT open_id, name, scope, access_expires_at, refresh_expires_at, reauth_required FROM feishu_user_oauth_tokens WHERE open_id=?').get(openId);
  if (!row) return { authorized: false };
  return {
    authorized: !row.reauth_required,
    reauth_required: !!row.reauth_required,
    open_id: row.open_id, name: row.name, scope: row.scope,
    access_expires_at: row.access_expires_at, refresh_expires_at: row.refresh_expires_at,
  };
}

// ── Minutes API（用 user_access_token）──
const MAX_TRANSCRIPT_BYTES = Number(process.env.FEISHU_TRANSCRIPT_MAX_BYTES || 10 * 1024 * 1024);
async function streamToString(rs) {
  const chunks = [];
  let total = 0;
  for await (const c of rs) {
    const b = Buffer.isBuffer(c) ? c : Buffer.from(c);
    total += b.length;
    if (total > MAX_TRANSCRIPT_BYTES) { const e = new Error('transcript 超过大小限制'); e.code = 'TRANSCRIPT_TOO_LARGE'; throw e; }
    chunks.push(b);
  }
  return Buffer.concat(chunks, total).toString('utf8');
}

// 把 lark/axios 抛出的错误归一化：抠出飞书 code/msg 挂到 error 上，方便上层透出
function normalizeFeishuError(label, e) {
  let body = e?.response?.data ?? e?.body ?? null;
  if (Buffer.isBuffer(body)) { try { body = JSON.parse(body.toString('utf8')); } catch { body = { msg: body.toString('utf8').slice(0, 300) }; } }
  const code = body?.code ?? e?.feishuCode;
  const msg = body?.msg ?? e?.message;
  const err = new Error(`${label}: ${code != null ? `code=${code} ` : ''}${msg || 'unknown'}`);
  err.feishuCode = code;
  err.feishuMsg = msg;
  return err;
}

export async function getMinute(minuteToken, openId) {
  const uat = await getFreshUserAccessToken(openId);
  try {
    const res = await client().minutes.v1.minute.get({ path: { minute_token: minuteToken } }, lark.withUserAccessToken(uat));
    return ensureOk('minute.get', res);
  } catch (e) { throw normalizeFeishuError('minute.get', e); }
}

export async function getTranscript(minuteToken, openId, fileFormat = 'srt') {
  const uat = await getFreshUserAccessToken(openId);
  try {
    // transcript 返回二进制流（writeFile/getReadableStream）
    const resp = await client().minutes.v1.minuteTranscript.get(
      { path: { minute_token: minuteToken }, params: { need_speaker: true, need_timestamp: true, file_format: fileFormat } },
      lark.withUserAccessToken(uat),
    );
    return streamToString(resp.getReadableStream());
  } catch (e) { throw normalizeFeishuError('transcript', e); }
}

// 搜「我的妙记」（user_access_token）。⚠️实测：**必须带 query 关键词·空 query 返空·`keyword` 字段无效**。
// body={query, page_size, start_time/end_time(秒字符串)}；返回 { items:[{token, display_info, meta_data}], has_more, page_token }。
// SDK 未封装该端点 → raw fetch（与 transcript 同样走 user_access_token）。
export async function searchMinutes(openId, { query, startTime, endTime, pageSize = 20 } = {}) {
  const q = String(query || '').trim();
  if (!q) return { items: [], has_more: false };
  const uat = await getFreshUserAccessToken(openId);
  const body = { query: q, page_size: Math.min(Math.max(Number(pageSize) || 20, 1), 100) };
  if (startTime) body.start_time = String(startTime);
  if (endTime) body.end_time = String(endTime);
  let resp, text;
  try {
    resp = await fetch('https://open.feishu.cn/open-apis/minutes/v1/minutes/search', {
      method: 'POST',
      headers: { authorization: `Bearer ${uat}`, 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });
    text = await resp.text();
  } catch (e) { throw normalizeFeishuError('minutes.search', e); }
  let json; try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
  if (!resp.ok || (json.code != null && json.code !== 0)) {
    throw normalizeFeishuError('minutes.search', { response: { status: resp.status, data: json } });
  }
  const data = json.data || {};
  return { items: Array.isArray(data.items) ? data.items : [], has_more: !!data.has_more, page_token: data.page_token };
}

// ── 续期 daemon：定期刷临期 token（防 idle 期间 refresh_token 自然过期）──
let _daemon = null;
export function startTokenRefreshDaemon(intervalMs = 30 * 60 * 1000) {
  if (_daemon) return;
  const tick = async () => {
    try {
      const soon = Date.now() + 60 * 60 * 1000; // 1h 内将过期的 access_token
      const rows = db.prepare('SELECT * FROM feishu_user_oauth_tokens WHERE reauth_required=0 AND access_expires_at < ? AND refresh_expires_at > ?').all(soon, Date.now());
      for (const row of rows) {
        try { await refreshRowLocked(row); console.log(`[feishu-oauth] 续期成功 open_id=${row.open_id}`); }
        catch (e) { console.warn(`[feishu-oauth] 续期失败 open_id=${row.open_id}: ${e.message}`); }
      }
    } catch (e) { console.warn('[feishu-oauth] daemon tick 错误:', e.message); }
  };
  _daemon = setInterval(tick, intervalMs);
  _daemon.unref?.();
}
export function stopTokenRefreshDaemon() { if (_daemon) { clearInterval(_daemon); _daemon = null; } }
