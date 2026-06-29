import crypto from 'crypto';

/**
 * InkLoop 共享密钥鉴权（sha256 + timingSafeEqual·定长比较不泄露 secret 长度）。
 * 与 routes/feishu-oauth.js 内的同名逻辑等价（此处抽出供 vault 路由复用）。
 *
 * ⚠️MVP 单用户：写入（设备→panel）用共享密钥可接受。
 *   多用户前，vault 读取（Obsidian 下载器）必须换 per-user 可吊销 token——
 *   把服务级共享密钥放进分发出去的下载器 = 泄露"读全员"能力（见压测 P0）。
 */
export function requireInkloopSecret(req, res, next) {
  const secret = process.env.INKLOOP_SHARED_SECRET || '';
  if (!secret) return res.status(503).json({ error: 'INKLOOP_SHARED_SECRET 未配置' });
  const got = crypto.createHash('sha256').update(req.get('x-inkloop-secret') || '', 'utf8').digest();
  const want = crypto.createHash('sha256').update(secret, 'utf8').digest();
  if (!crypto.timingSafeEqual(got, want)) return res.status(401).json({ error: 'unauthorized' });
  next();
}
