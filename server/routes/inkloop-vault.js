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
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import db from '../db/init.js';
import { requireInkloopSecret } from '../middleware/inkloop-secret.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VAULT_DIR = resolve(process.env.VAULT_RELEASE_DIR || join(__dirname, '..', 'vault-releases')); // 非公开（不在 /api/uploads static 树下）
const RELEASE_SCHEMA = 'inkloop.vault_release.v1';

const router = Router();
router.use(requireInkloopSecret);
router.use(express.json({ limit: process.env.VAULT_RELEASE_BODY_LIMIT || '50mb' }));

// userId/deviceId 进路径/磁盘路径 → 严格白名单（防路径逃逸/注入）
const sanId = (s) => (typeof s === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : null);

// vault 内相对路径校验：必须 InkLoop/ 开头·禁 ..、.、空段、反斜杠、NUL（与下载器同口径）
function validateVaultPath(p) {
  if (typeof p !== 'string' || !p) return 'empty';
  if (!p.startsWith('InkLoop/')) return 'not under InkLoop/';
  if (p.includes('\\') || p.includes('\0')) return 'illegal char';
  if (p.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) return 'illegal segment';
  return null;
}

const sha256Hex = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

// 原子写 blob（内容寻址·已存在跳过）：tmp → fsync → rename。返回相对 VAULT_DIR 的 disk_path。
function writeBlobAtomic(userId, hex, markdown) {
  const rel = join(userId, 'sha256', hex.slice(0, 2), `${hex}.md`);
  const abs = join(VAULT_DIR, rel);
  if (existsSync(abs)) return rel; // 同 hash=同内容·信内容寻址
  mkdirSync(dirname(abs), { recursive: true });
  const tmp = `${abs}.tmp-${crypto.randomBytes(6).toString('hex')}`;
  const fd = openSync(tmp, 'w');
  try {
    writeSync(fd, markdown, null, 'utf8');
    fsyncSync(fd); // 落盘后再 rename·防半截（崩溃一致性）
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, abs);
  return rel;
}

// ── POST 上传 release ──
router.post('/users/:userId/releases', (req, res) => {
  const userId = sanId(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'bad userId' });
  const { manifest, files, device_id } = req.body || {};
  const deviceId = sanId(device_id) || ''; // 仅元数据

  if (!manifest || manifest.schema_version !== RELEASE_SCHEMA) return res.status(400).json({ error: `schema_version != ${RELEASE_SCHEMA}` });
  if (typeof manifest.release_hash !== 'string' || !manifest.release_hash) return res.status(400).json({ error: 'missing release_hash' });
  if (!Array.isArray(manifest.files) || !Array.isArray(files) || manifest.files.length !== files.length) return res.status(400).json({ error: 'files/manifest length mismatch' });

  // 幂等：同 user+release_hash 已存在 → 只把 latest 指过去·返已有（不 409·不重写）
  const existing = db.prepare('SELECT id FROM vault_releases WHERE user_id = ? AND release_hash = ?').get(userId, manifest.release_hash);
  if (existing) {
    db.prepare("INSERT INTO vault_latest(user_id, release_id, updated_at) VALUES(?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET release_id = excluded.release_id, updated_at = excluded.updated_at").run(userId, existing.id);
    return res.json({ ok: true, release_id: existing.id, deduped: true });
  }

  // 逐文件校验：path 合法 + manifest/files 同序同 path + 重算 sha256/bytes 对齐
  const prepared = [];
  let totalBytes = 0;
  for (let i = 0; i < files.length; i++) {
    const mf = manifest.files[i];
    const ff = files[i];
    if (!mf || !ff || typeof ff.markdown !== 'string' || mf.path !== ff.path) return res.status(400).json({ error: `file[${i}] path/order mismatch` });
    const pathErr = validateVaultPath(mf.path);
    if (pathErr) return res.status(400).json({ error: `file[${i}] path ${pathErr}: ${mf.path}` });
    const hex = sha256Hex(ff.markdown);
    const ch = `sha256:${hex}`;
    const bytes = Buffer.byteLength(ff.markdown, 'utf8');
    if (ch !== mf.content_hash || bytes !== mf.bytes) return res.status(400).json({ error: `file[${i}] hash/bytes mismatch` });
    prepared.push({ hex, content_hash: ch, path: mf.path, bytes, markdown: ff.markdown });
    totalBytes += bytes;
  }

  // 先把所有 blob 落盘（原子·内容寻址），再开 DB 事务记录（全落盘后才提交·避免 latest 指向缺 blob）
  let written;
  try {
    written = prepared.map((b) => ({ ...b, disk_path: writeBlobAtomic(userId, b.hex, b.markdown) }));
  } catch (e) {
    return res.status(500).json({ error: `blob write failed: ${e.message}` });
  }

  const releaseId = crypto.randomUUID();
  const insRelease = db.prepare('INSERT INTO vault_releases(id, user_id, device_id, release_hash, schema_version, app_version, generated_at, manifest_json, file_count, total_bytes) VALUES(?,?,?,?,?,?,?,?,?,?)');
  const insFile = db.prepare('INSERT INTO vault_release_files(release_id, sort_order, path, content_hash, bytes) VALUES(?,?,?,?,?)');
  const insBlob = db.prepare('INSERT INTO vault_blobs(user_id, content_hash, bytes, disk_path) VALUES(?,?,?,?) ON CONFLICT(user_id, content_hash) DO NOTHING');
  const setLatest = db.prepare("INSERT INTO vault_latest(user_id, release_id, updated_at) VALUES(?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET release_id = excluded.release_id, updated_at = excluded.updated_at");
  const txn = db.transaction(() => {
    insRelease.run(releaseId, userId, deviceId, manifest.release_hash, manifest.schema_version, String(manifest.app_version || ''), String(manifest.generated_at || ''), JSON.stringify(manifest), written.length, totalBytes);
    written.forEach((b, i) => {
      insFile.run(releaseId, i, b.path, b.content_hash, b.bytes);
      insBlob.run(userId, b.content_hash, b.bytes, b.disk_path);
    });
    setLatest.run(userId, releaseId);
  });
  try {
    txn();
  } catch (e) {
    return res.status(500).json({ error: `db txn failed: ${e.message}` });
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
  if (!abs.startsWith(VAULT_DIR + '/') || !existsSync(abs)) return res.status(503).json({ error: 'blob missing' }); // 防越界 + 盘上缺失
  res.set('ETag', `"${hex}"`);
  res.type('text/markdown; charset=utf-8');
  res.sendFile(abs);
});

export default router;
