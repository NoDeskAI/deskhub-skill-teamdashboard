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

// 仅用于 minutes/authen API 的 HTTP client（≠ feishu.js 里那个收消息的 WSClient，互不影响）
let _client = null;
function client() {
  if (_client) return _client;
  if (!APP_ID || !APP_SECRET) throw new Error('FEISHU_APP_ID / FEISHU_APP_SECRET 未配置');
  _client = new lark.Client({ appId: APP_ID, appSecret: APP_SECRET, appType: lark.AppType.SelfBuild, domain: lark.Domain.Feishu });
  return _client;
}

// ── token 加解密（AES-256-GCM）──
// key 优先用 env FEISHU_TOKEN_ENC_KEY(64 hex=32B)，否则从 APP_SECRET 派生（scrypt）
function encKey() {
  const hex = process.env.FEISHU_TOKEN_ENC_KEY;
  if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, 'hex');
  if (!APP_SECRET) throw new Error('无法派生 token 加密 key：APP_SECRET 缺失');
  return crypto.scryptSync(APP_SECRET, 'inkloop-feishu-oauth-v1', 32);
}
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}
function decrypt(blob) {
  const [ivB, tagB, ctB] = String(blob).split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey(), Buffer.from(ivB, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB, 'base64')), decipher.final()]).toString('utf8');
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

// ── 刷新单个 token（rolling：写回新的 access+refresh）──
async function refreshRow(row) {
  const refreshToken = decrypt(row.refresh_token_enc);
  let d;
  try {
    const res = await client().authen.refreshAccessToken.create({ data: { grant_type: 'refresh_token', refresh_token: refreshToken } });
    d = ensureOk('authen.refreshAccessToken.create', res);
  } catch (e) {
    // refresh_token 过期/撤销 → 标记需重新授权
    db.prepare('UPDATE feishu_user_oauth_tokens SET reauth_required=1, updated_at=datetime(\'now\') WHERE open_id=?').run(row.open_id);
    const err = new Error(`刷新失败(需重新授权): ${e.message}`);
    err.reauthRequired = true;
    throw err;
  }
  if (!d?.access_token) {
    db.prepare('UPDATE feishu_user_oauth_tokens SET reauth_required=1, updated_at=datetime(\'now\') WHERE open_id=?').run(row.open_id);
    const err = new Error('刷新返回缺 access_token（需重新授权）');
    err.reauthRequired = true;
    throw err;
  }
  // open_id 不变；refresh 响应可能不回 open_id，补上
  saveToken({ ...d, open_id: row.open_id, union_id: d.union_id || row.union_id, user_id: d.user_id || row.user_id, name: d.name || row.name });
  return d.access_token;
}

// ── 拿一个新鲜的 user_access_token（懒刷新：临期 5min 内先刷）──
export async function getFreshUserAccessToken(openId) {
  const row = db.prepare('SELECT * FROM feishu_user_oauth_tokens WHERE open_id=?').get(openId);
  if (!row) { const e = new Error('该用户未授权飞书'); e.code = 'NO_TOKEN'; throw e; }
  if (row.reauth_required) { const e = new Error('该用户授权已失效，需重新授权'); e.code = 'REAUTH_REQUIRED'; throw e; }
  if (row.access_expires_at > Date.now() + 5 * 60 * 1000) return decrypt(row.access_token_enc);
  // 临期或已过期 → 刷新
  return refreshRow(row);
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
function streamToString(rs) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    rs.on('data', (c) => chunks.push(Buffer.from(c)));
    rs.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    rs.on('error', reject);
  });
}

export async function getMinute(minuteToken, openId) {
  const uat = await getFreshUserAccessToken(openId);
  const res = await client().minutes.v1.minute.get({ path: { minute_token: minuteToken } }, lark.withUserAccessToken(uat));
  return ensureOk('minute.get', res);
}

export async function getTranscript(minuteToken, openId, fileFormat = 'srt') {
  const uat = await getFreshUserAccessToken(openId);
  // transcript 返回二进制流（writeFile/getReadableStream）
  const resp = await client().minutes.v1.minuteTranscript.get(
    { path: { minute_token: minuteToken }, params: { need_speaker: true, need_timestamp: true, file_format: fileFormat } },
    lark.withUserAccessToken(uat),
  );
  const rs = resp.getReadableStream();
  return streamToString(rs);
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
        try { await refreshRow(row); console.log(`[feishu-oauth] 续期成功 open_id=${row.open_id}`); }
        catch (e) { console.warn(`[feishu-oauth] 续期失败 open_id=${row.open_id}: ${e.message}`); }
      }
    } catch (e) { console.warn('[feishu-oauth] daemon tick 错误:', e.message); }
  };
  _daemon = setInterval(tick, intervalMs);
  _daemon.unref?.();
}
export function stopTokenRefreshDaemon() { if (_daemon) { clearInterval(_daemon); _daemon = null; } }
