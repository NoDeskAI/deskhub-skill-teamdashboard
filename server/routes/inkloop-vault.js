/**
 * InkLoop Vault Release 端点（交付路线 Y · 设备→panel 存 / Obsidian 下载器拉）。
 *
 * per-user 塑形（device 仅元数据·不进 scoping/PK）；MVP 单用户先跑通。鉴权=共享密钥（见 middleware/inkloop-secret·多用户前换 per-user token）。
 * 端点（都在 index.js 的全局 express.json() **之前**挂载——否则全局默认 ~100KB 会先拦死大 release）：
 *   POST /api/inkloop/vault/users/:userId/releases          收 {manifest, files, device_id?}·校验+原子写 blob+事务记录·幂等
 *   GET  /api/inkloop/vault/users/:userId/releases/latest    返 {release, manifest, assets[含 download URL]}
 *   GET  /api/inkloop/vault/users/:userId/blobs/sha256/:hex   鉴权后 sendFile（text/markdown·ETag）
 *
 * 堵压测 blocker：①全局 json 陷阱（本路由自带 50mb parser·挂全局前）②原子（blob tmp→fsync→rename·全落盘后再 DB 事务）
 *   ③路径校验（InkLoop/ 开头禁 ../反斜杠/NUL·hex 正则）④幂等（同 user+release_hash 重发返已有·非 409）⑤blob 按 user 分桶（堵跨用户秒传泄露）。
 */
import { Router } from 'express';
import express from 'express';
import crypto from 'crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, renameSync, writeFileSync, writeSync } from 'fs';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import db from '../db/init.js';
import { requireInkloopSecret } from '../middleware/inkloop-secret.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VAULT_DIR = resolve(process.env.VAULT_RELEASE_DIR || join(__dirname, '..', 'vault-releases')); // 非公开（不在 /api/uploads static 树下）
const RELEASE_SCHEMA = 'inkloop.vault_release.v1';
const RELEASE_HASH_RE = /^(?:sha256:)?[a-f0-9]{64}$/;
const MAX_FILES = Math.max(1, Number.parseInt(process.env.VAULT_RELEASE_MAX_FILES || '2000', 10) || 2000);
const MAX_PATH_BYTES = Math.max(64, Number.parseInt(process.env.VAULT_RELEASE_MAX_PATH_BYTES || '1024', 10) || 1024);

const router = Router();
router.use(requireInkloopSecret);
router.use(express.json({ limit: process.env.VAULT_RELEASE_BODY_LIMIT || '50mb' }));
// 坏 JSON / 超限 → 明确 400/413（否则落全局兜底返 500·状态码错）
router.use((err, _req, res, next) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'release payload too large' });
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) return res.status(400).json({ error: 'invalid JSON' });
  next(err);
});

// userId/deviceId 进路径/磁盘路径 → 严格白名单（防路径逃逸/注入）
const sanId = (s) => (typeof s === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : null);

// vault 内相对路径校验：必须 InkLoop/ 开头·禁 ..、.、空段、反斜杠、NUL（与下载器同口径）
function validateVaultPath(p) {
  if (typeof p !== 'string' || !p) return 'empty';
  if (!p.startsWith('InkLoop/')) return 'not under InkLoop/';
  if (p.includes('\\') || p.includes('\0')) return 'illegal char';
  if (Buffer.byteLength(p, 'utf8') > MAX_PATH_BYTES) return 'too long';
  if (p.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) return 'illegal segment';
  return null;
}

const sha256Hex = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

// release_hash 服务端复算（**必须与 InkLoop 侧 buildVaultRelease 同口径**：按 path 排序的 `<path> <content_hash>` 换行串求 sha256）。
// 不复算就等于信客户端任意串——同 hash 不同内容会被静默当旧 release。
function computeReleaseHash(prepared) {
  const lines = [...prepared].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)).map((f) => `${f.path} ${f.content_hash}`);
  return `sha256:${sha256Hex(lines.join('\n'))}`;
}
function normalizeReleaseHash(h) {
  if (typeof h !== 'string' || !RELEASE_HASH_RE.test(h)) return null;
  return h.startsWith('sha256:') ? h : `sha256:${h}`;
}
function isReleaseHashConflict(e) {
  return String(e?.message || '').includes('UNIQUE constraint failed') && String(e?.message || '').includes('vault_releases');
}
function fsyncDir(dir) {
  let fd;
  try { fd = openSync(dir, 'r'); fsyncSync(fd); } catch (e) { if (process.platform !== 'win32') throw e; } finally { if (fd !== undefined) closeSync(fd); }
}

// 原子写 blob（内容寻址·已存在跳过）：tmp → fsync(file) → rename → fsync(dir)。返回相对 VAULT_DIR 的 disk_path。
function writeBlobAtomic(userId, hex, markdown) {
  const rel = join(userId, 'sha256', hex.slice(0, 2), `${hex}.md`);
  const abs = join(VAULT_DIR, rel);
  if (existsSync(abs)) return rel; // 同 hash=同内容·信内容寻址
  const dir = dirname(abs);
  mkdirSync(dir, { recursive: true });
  const tmp = `${abs}.tmp-${crypto.randomBytes(6).toString('hex')}`;
  const fd = openSync(tmp, 'w');
  try {
    writeSync(fd, markdown, null, 'utf8');
    fsyncSync(fd); // 落盘后再 rename·防半截
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, abs);
  fsyncDir(dir); // 目录项也落盘·防"DB 已提交但目录没持久化"（断电一致性）
  return rel;
}

// ── POST 上传 release ──
router.post('/users/:userId/releases', (req, res) => {
  const userId = sanId(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'bad userId' });
  const { manifest, files, device_id } = req.body || {};
  let deviceId = ''; // 仅元数据
  if (device_id !== undefined && device_id !== null && device_id !== '') {
    deviceId = sanId(device_id);
    if (!deviceId) return res.status(400).json({ error: 'bad device_id' }); // 别静默吞客户端 bug
  }

  if (!manifest || manifest.schema_version !== RELEASE_SCHEMA) return res.status(400).json({ error: `schema_version != ${RELEASE_SCHEMA}` });
  const clientHash = normalizeReleaseHash(manifest.release_hash);
  if (!clientHash) return res.status(400).json({ error: 'bad release_hash' });
  if (!Array.isArray(manifest.files) || !Array.isArray(files) || manifest.files.length !== files.length) return res.status(400).json({ error: 'files/manifest length mismatch' });
  if (files.length > MAX_FILES) return res.status(413).json({ error: `too many files (max ${MAX_FILES})` });

  // 逐文件校验：path 合法 + 无重复 path + manifest/files 同序同 path + 重算 sha256/bytes 对齐
  const prepared = [];
  const seenPaths = new Set();
  let totalBytes = 0;
  for (let i = 0; i < files.length; i++) {
    const mf = manifest.files[i];
    const ff = files[i];
    if (!mf || !ff || typeof ff.markdown !== 'string' || mf.path !== ff.path) return res.status(400).json({ error: `file[${i}] path/order mismatch` });
    const pathErr = validateVaultPath(mf.path);
    if (pathErr) return res.status(400).json({ error: `file[${i}] path ${pathErr}: ${mf.path}` });
    if (seenPaths.has(mf.path)) return res.status(400).json({ error: `duplicate path: ${mf.path}` }); // 防 vault_release_files PK 冲突→永久失败+孤儿 blob
    seenPaths.add(mf.path);
    const hex = sha256Hex(ff.markdown);
    const ch = `sha256:${hex}`;
    const bytes = Buffer.byteLength(ff.markdown, 'utf8');
    if (ch !== mf.content_hash || bytes !== mf.bytes) return res.status(400).json({ error: `file[${i}] hash/bytes mismatch` });
    prepared.push({ hex, content_hash: ch, path: mf.path, bytes, markdown: ff.markdown });
    totalBytes += bytes;
  }

  // 服务端复算 release_hash 并校验（防客户端给假 hash 致同 hash 不同内容被静默当旧 release）。
  const releaseHash = computeReleaseHash(prepared);
  if (clientHash !== releaseHash) return res.status(400).json({ error: 'release_hash mismatch' });
  const storedManifest = { ...manifest, release_hash: releaseHash };

  // 幂等：同 user+复算 hash 已存在 → 只把 latest 指过去·返已有（不 409·不重写）
  const existing = db.prepare('SELECT id FROM vault_releases WHERE user_id = ? AND release_hash = ?').get(userId, releaseHash);
  if (existing) {
    db.prepare("INSERT INTO vault_latest(user_id, release_id, updated_at) VALUES(?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET release_id = excluded.release_id, updated_at = excluded.updated_at").run(userId, existing.id);
    return res.json({ ok: true, release_id: existing.id, deduped: true });
  }

  // 先把所有 blob 落盘（原子·内容寻址），再开 DB 事务记录（全落盘后才提交·避免 latest 指向缺 blob）
  let written;
  try {
    written = prepared.map((b) => ({ ...b, disk_path: writeBlobAtomic(userId, b.hex, b.markdown) }));
  } catch (e) {
    console.error('[inkloop-vault/blob]', e);
    return res.status(500).json({ error: 'blob write failed' });
  }

  const releaseId = crypto.randomUUID();
  const insRelease = db.prepare('INSERT INTO vault_releases(id, user_id, device_id, release_hash, schema_version, app_version, generated_at, manifest_json, file_count, total_bytes) VALUES(?,?,?,?,?,?,?,?,?,?)');
  const insFile = db.prepare('INSERT INTO vault_release_files(release_id, sort_order, path, content_hash, bytes) VALUES(?,?,?,?,?)');
  const insBlob = db.prepare('INSERT INTO vault_blobs(user_id, content_hash, bytes, disk_path) VALUES(?,?,?,?) ON CONFLICT(user_id, content_hash) DO NOTHING');
  const setLatest = db.prepare("INSERT INTO vault_latest(user_id, release_id, updated_at) VALUES(?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET release_id = excluded.release_id, updated_at = excluded.updated_at");
  const txn = db.transaction(() => {
    insRelease.run(releaseId, userId, deviceId, releaseHash, manifest.schema_version, String(manifest.app_version || ''), String(manifest.generated_at || ''), JSON.stringify(storedManifest), written.length, totalBytes);
    written.forEach((b, i) => {
      insFile.run(releaseId, i, b.path, b.content_hash, b.bytes);
      insBlob.run(userId, b.content_hash, b.bytes, b.disk_path);
    });
    setLatest.run(userId, releaseId);
  });
  try {
    txn();
  } catch (e) {
    if (isReleaseHashConflict(e)) { // 并发同 release_hash 竞态 → 已有那条胜·指 latest 返已有（非 500）
      const raced = db.prepare('SELECT id FROM vault_releases WHERE user_id = ? AND release_hash = ?').get(userId, releaseHash);
      if (raced) { setLatest.run(userId, raced.id); return res.json({ ok: true, release_id: raced.id, deduped: true }); }
    }
    console.error('[inkloop-vault/db]', e);
    return res.status(500).json({ error: 'db txn failed' });
  }
  res.json({ ok: true, release_id: releaseId, file_count: written.length, total_bytes: totalBytes });
});

// ── GET 最新 release manifest（带每文件 download URL） ──
router.get('/users/:userId/releases/latest', (req, res) => {
  const userId = sanId(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'bad userId' });
  const latest = db.prepare('SELECT r.* FROM vault_latest l JOIN vault_releases r ON r.id = l.release_id WHERE l.user_id = ?').get(userId);
  if (!latest) return res.status(404).json({ error: 'no release' });
  let manifest;
  try {
    manifest = JSON.parse(latest.manifest_json);
  } catch {
    return res.status(500).json({ error: 'corrupt manifest' });
  }
  const base = `/api/inkloop/vault/users/${encodeURIComponent(userId)}/blobs`;
  const assets = (manifest.files || []).map((f) => ({ path: f.path, content_hash: f.content_hash, bytes: f.bytes, download: `${base}/${String(f.content_hash).replace(':', '/')}` }));
  res.json({ release: { id: latest.id, release_hash: latest.release_hash, generated_at: latest.generated_at, uploaded_at: latest.uploaded_at }, manifest, assets });
});

// ── GET blob（内容寻址·鉴权后 sendFile） ──
router.get('/users/:userId/blobs/sha256/:hex', (req, res) => {
  const userId = sanId(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'bad userId' });
  const hex = req.params.hex;
  if (!/^[a-f0-9]{64}$/.test(hex)) return res.status(400).json({ error: 'bad hash' });
  const blob = db.prepare('SELECT disk_path FROM vault_blobs WHERE user_id = ? AND content_hash = ?').get(userId, `sha256:${hex}`);
  if (!blob) return res.status(404).json({ error: 'not found' });
  const abs = resolve(VAULT_DIR, blob.disk_path);
  const diskRel = relative(VAULT_DIR, abs);
  if (diskRel.startsWith('..') || isAbsolute(diskRel) || !existsSync(abs)) return res.status(503).json({ error: 'blob missing' }); // 防越界（relative 兜底）+ 盘上缺失
  res.set('ETag', `"${hex}"`);
  res.type('text/markdown; charset=utf-8');
  res.sendFile(abs);
});

export default router;
