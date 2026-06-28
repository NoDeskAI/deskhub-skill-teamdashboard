/**
 * 飞书 OAuth + 妙记取数路由（WS2·InkLoop 会议转写对轴用）
 *
 * 公开（浏览器走）：
 *   GET /api/feishu/oauth/start         → 302 到飞书授权页
 *   GET /api/feishu/oauth/callback      → 收 code，换 token 入库，回成功页
 * InkLoop 调（x-inkloop-secret 鉴权）：
 *   GET /api/feishu/oauth/status        → 查授权用户列表 / 单个状态
 *   GET /api/feishu/minutes/:token      → 妙记元信息
 *   GET /api/feishu/minutes/:token/transcript?format=srt → 带时间戳转写
 *
 * 注意：本路由必须挂在 index.js 的 `app.use('/api', requireAuth, ...)` 之前
 *       （飞书回调不带 panel session cookie；InkLoop 用独立 shared secret）。
 */
import { Router } from 'express';
import crypto from 'crypto';
import {
  buildAuthorizeUrl, consumeState, exchangeCodeAndStore,
  getMinute, getTranscript, tokenStatus, listAuthorized, soleAuthorizedOpenId,
} from '../bot/feishu-minutes.js';
import { recentMeetings, getMeeting } from '../bot/feishu-events.js';

const router = Router();

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// 回跳白名单：只允许 redirect_uri 同源（或 env 显式列出的）origin，防开放重定向
function allowedReturnOrigins() {
  const fallback = new URL(process.env.FEISHU_REDIRECT_URI || 'https://nodeskweb.xiaobuyu.trade/api/feishu/oauth/callback').origin;
  return new Set((process.env.FEISHU_OAUTH_RETURN_ORIGINS || fallback).split(',').map((s) => s.trim()).filter(Boolean));
}
function safeReturnTo(v) {
  try {
    const u = new URL(String(v || ''));
    if (!['http:', 'https:'].includes(u.protocol)) return '';
    return allowedReturnOrigins().has(u.origin) ? u.toString() : '';
  } catch { return ''; }
}

// InkLoop 端点鉴权（先 sha256 再 timingSafeEqual·定长比较不泄露 secret 长度）
function requireInkloopSecret(req, res, next) {
  const secret = process.env.INKLOOP_SHARED_SECRET || '';
  if (!secret) return res.status(503).json({ error: 'INKLOOP_SHARED_SECRET 未配置' });
  const got = crypto.createHash('sha256').update(req.get('x-inkloop-secret') || '', 'utf8').digest();
  const want = crypto.createHash('sha256').update(secret, 'utf8').digest();
  if (!crypto.timingSafeEqual(got, want)) return res.status(401).json({ error: 'unauthorized' });
  next();
}

// ── 公开：发起授权 ──
router.get('/oauth/start', (req, res) => {
  try {
    const url = buildAuthorizeUrl(req.query.return || '');
    res.redirect(url);
  } catch (e) {
    res.status(500).send(`授权 URL 生成失败：${e.message}`);
  }
});

// ── 公开：回调 ──
router.get('/oauth/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const page = (title, body) => `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font-family:-apple-system,system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1.5rem;color:#1f2328;line-height:1.6}h1{font-size:1.3rem}.ok{color:#1a7f37}.err{color:#cf222e}code{background:#f6f8fa;padding:.1em .4em;border-radius:4px}</style></head><body>${body}</body></html>`;
  if (error) {
    return res.status(400).send(page('授权失败', `<h1 class="err">飞书授权失败</h1><p><code>${escapeHtml(error)}</code> ${escapeHtml(error_description || '')}</p>`));
  }
  if (!code || !state) {
    return res.status(400).send(page('参数缺失', '<h1 class="err">缺少 code 或 state</h1>'));
  }
  const st = consumeState(String(state));
  if (!st) {
    return res.status(400).send(page('state 校验失败', '<h1 class="err">state 无效或已过期</h1><p>请重新发起授权。</p>'));
  }
  try {
    const info = await exchangeCodeAndStore(String(code));
    const returnTo = safeReturnTo(st.returnTo);
    const ret = returnTo ? `<p><a rel="noopener noreferrer" href="${escapeHtml(returnTo)}">返回</a></p>` : '';
    res.send(page('授权成功', `<h1 class="ok">✅ 飞书授权成功</h1><p>已绑定用户 <code>${escapeHtml(info.name || info.open_id)}</code>，InkLoop 现在可以读取你的妙记转写了。</p><p>可以关闭本页。</p>${ret}`));
  } catch {
    res.status(502).send(page('换取令牌失败', '<h1 class="err">换取令牌失败</h1><p>请重新发起授权。</p>'));
  }
});

// ── InkLoop：授权状态 ──
router.get('/oauth/status', requireInkloopSecret, (req, res) => {
  try {
    if (req.query.open_id) return res.json(tokenStatus(String(req.query.open_id)));
    res.json({ users: listAuthorized() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── InkLoop：最近会议（带 t0 start_time + 关联的 minute_token，供端内对轴）──
router.get('/meetings/recent', requireInkloopSecret, (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    res.json({ meetings: recentMeetings(limit) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/meetings/:meeting_id', requireInkloopSecret, (req, res) => {
  try {
    const m = getMeeting(req.params.meeting_id);
    if (!m) return res.status(404).json({ error: 'meeting not found' });
    res.json({ meeting: m });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 解析 open_id：query 优先，否则单授权用户兜底
function resolveOpenId(req) {
  if (req.query.open_id) return String(req.query.open_id);
  return soleAuthorizedOpenId();
}

// ── InkLoop：妙记元信息 ──
router.get('/minutes/:token', requireInkloopSecret, async (req, res) => {
  const openId = resolveOpenId(req);
  if (!openId) return res.status(400).json({ error: '需指定 open_id（存在多个或零个授权用户）' });
  try {
    const data = await getMinute(req.params.token, openId);
    res.json({ open_id: openId, minute: data?.minute ?? data });
  } catch (e) { res.status(mapErr(e)).json({ error: e.message, code: e.code || e.feishuCode }); }
});

// ── InkLoop：带时间戳转写 ──
router.get('/minutes/:token/transcript', requireInkloopSecret, async (req, res) => {
  const openId = resolveOpenId(req);
  if (!openId) return res.status(400).json({ error: '需指定 open_id（存在多个或零个授权用户）' });
  const fmt = ['srt', 'txt'].includes(String(req.query.format)) ? String(req.query.format) : 'srt';
  try {
    const text = await getTranscript(req.params.token, openId, fmt);
    res.json({ open_id: openId, minute_token: req.params.token, format: fmt, transcript: text });
  } catch (e) { res.status(mapErr(e)).json({ error: e.message, code: e.code || e.feishuCode }); }
});

function mapErr(e) {
  if (e.code === 'NO_TOKEN' || e.code === 'REAUTH_REQUIRED') return 409; // 需（重新）授权
  return 502;
}

export default router;
