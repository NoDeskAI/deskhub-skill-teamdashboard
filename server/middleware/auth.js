import jwt from 'jsonwebtoken';
import db from '../db/init.js';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET 未设置，生产环境不允许使用默认密钥。请在 .env 中配置 JWT_SECRET');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET || 'deskhub-teamboard-secret';

/**
 * 小合代理鉴权尝试
 *
 * 如果请求带 X-Xiaohe-Proxy + X-Xiaohe-Secret，校验 secret 并 impersonate 委托者身份：
 *   - 设置 req.user / req.role 为委托者（像他本人登录一样）
 *   - 额外标记 req.xiaoheProxy = true 和 req.proxyAuthorId = 委托者 username
 *   写入路由看到 req.xiaoheProxy 时会自动把 author_type='ai' 写进去
 *
 * @returns true 如果走了代理路径（next 已调用），false 如果不是代理请求（让上游走 JWT）
 */
function tryXiaoheProxyAuth(req, res, next) {
  const proxyUserId = req.headers['x-xiaohe-proxy'];
  if (!proxyUserId) return false;

  const expectedSecret = process.env.XIAOHE_INTERNAL_SECRET;
  if (!expectedSecret) {
    console.error('[Auth] 收到 X-Xiaohe-Proxy 但 XIAOHE_INTERNAL_SECRET 未配置，拒绝');
    res.status(500).json({ error: '小合代理 secret 服务端未配置' });
    return true;
  }
  const providedSecret = req.headers['x-xiaohe-secret'];
  if (providedSecret !== expectedSecret) {
    res.status(403).json({ error: '小合代理 secret 不匹配' });
    return true;
  }

  const user = db.prepare('SELECT username, role FROM users WHERE username = ?').get(proxyUserId);
  if (!user) {
    res.status(403).json({ error: `小合代理委托者 ${proxyUserId} 不存在` });
    return true;
  }

  req.auth = { username: user.username, role: user.role, proxied: true };
  req.role = user.role;
  req.user = user.username;
  req.xiaoheProxy = true;
  req.proxyAuthorId = user.username;
  console.log(`[Auth] 小合代理通过，impersonate user=${user.username} role=${user.role}`);
  next();
  return true;
}

/**
 * requireAuth — 验证 Bearer token / 小合代理 header，设置 req.role / req.user / req.auth
 */
export function requireAuth(req, res, next) {
  // 优先尝试小合代理（内部 secret）
  if (tryXiaoheProxyAuth(req, res, next)) return;

  // 走标准 JWT 鉴权
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.auth = payload;
    req.role = payload.role;
    req.user = payload.username;
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

/**
 * requireRole — 在 requireAuth 基础上检查角色
 * 用法: requireRole('admin', 'tester')
 */
export function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.auth) {
      return requireAuth(req, res, () => {
        if (!allowed.includes(req.role)) {
          return res.status(403).json({ error: `角色 ${req.role} 无权执行此操作` });
        }
        next();
      });
    }
    if (!allowed.includes(req.role)) {
      return res.status(403).json({ error: `角色 ${req.role} 无权执行此操作` });
    }
    next();
  };
}

export { JWT_SECRET };
