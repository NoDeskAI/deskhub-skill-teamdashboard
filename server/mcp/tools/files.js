/**
 * MCP 文件操作 tool
 *
 * 补齐前端 89% → 95% 覆盖度的那个缺口：团队成员通过 MCP 客户端上传附件到方案。
 *
 * 行为对齐 POST /api/upload + PUT /api/variants/:id (attachments):
 *   - base64 解码 → 写入 UPLOAD_DIR/eval/{uid}-{原名}
 *   - variant.attachments JSON 追加 {path, originalName, size}
 */

import { z } from 'zod';
import crypto from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as ops from '../db-ops.js';
import { assertRole } from '../auth-check.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(__dirname, '..', '..', 'uploads');
const EVAL_DIR = join(UPLOAD_DIR, 'eval');
const MAX_FILE_SIZE = 10 * 1024 * 1024;   // 10MB，和 multer 配置对齐

mkdirSync(EVAL_DIR, { recursive: true });

function uid() {
  return crypto.randomUUID().slice(0, 8);
}

function sanitizeFilename(name) {
  // 保留中文 / 字母数字 / 点 / 横线 / 下划线，其余替换为 _
  return name.replace(/[^\p{L}\p{N}._-]/gu, '_').slice(0, 128);
}

export function registerFileTools(server, auth) {
  server.tool(
    'upload_files',
    '给某个方案（variant）上传附件文件。文件内容用 base64 编码传输。需要 admin/tester/member 权限。',
    {
      variant_id: z.string().describe('方案 ID'),
      files: z.array(z.object({
        filename: z.string().describe('原文件名（含扩展名，如 "report.pdf"）'),
        content_base64: z.string().describe('文件内容的 base64 编码'),
      })).min(1).max(10).describe('要上传的文件列表，最多 10 个'),
    },
    async ({ variant_id, files }) => {
      assertRole(auth, 'admin', 'tester', 'member');

      const entries = [];
      for (const f of files) {
        const buf = Buffer.from(f.content_base64, 'base64');
        if (buf.length > MAX_FILE_SIZE) {
          throw new Error(`文件 ${f.filename} 超过 10MB 上限（${(buf.length / 1024 / 1024).toFixed(2)}MB）`);
        }
        if (buf.length === 0) {
          throw new Error(`文件 ${f.filename} 内容为空`);
        }
        const safeName = sanitizeFilename(f.filename);
        const diskName = `${uid()}-${safeName}`;
        const diskPath = join(EVAL_DIR, diskName);
        writeFileSync(diskPath, buf);

        entries.push({
          path: `uploads/eval/${diskName}`,
          originalName: f.filename,
          size: buf.length,
        });
      }

      const updated = ops.appendVariantFiles(variant_id, entries);

      const summary = entries.map(e =>
        `  • ${e.originalName} (${(e.size / 1024).toFixed(1)}KB) → ${e.path}`
      ).join('\n');

      return {
        content: [{
          type: 'text',
          text: `已上传 ${entries.length} 个文件到方案 ${variant_id}：\n${summary}\n\n该方案当前共 ${updated.length} 个附件。`,
        }],
      };
    }
  );
}
