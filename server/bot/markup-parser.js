/**
 * LLM 流式文本中 [[tag:args]] markup 解析器
 *
 * 用法：
 *   const stream = new MarkupStream();
 *   for (const delta of chunks) {
 *     const parts = stream.feed(delta);   // 返回已定稿的 parts 数组
 *     for (const p of parts) handlePart(p);
 *   }
 *   const tail = stream.flush();   // 流结束时把 pending buffer 兜底 emit
 *
 * 解析规则：
 *   - 扫最后一个 `[[`：若无 `]]` 闭合 → 不 emit，等下个 chunk
 *   - 若 `[[` 后超过 MAX_PENDING 字符仍无闭合 → 当普通文本兜底 emit
 *   - 闭合时按 `[[tag:arg1|arg2]]` 切解析：
 *     - tag 不在白名单 → 当普通文本 emit
 *     - args 按 `|` split（prompt 里约定 args 内不含 `|` 和 `]`）
 *
 * 输出 part 形状：
 *   { kind: 'text', text: string }
 *   { kind: 'markup', tag: string, args: string[], placement: 'inline' | 'block' }
 */

// 白名单 + placement 映射
export const TAG_PLACEMENT = {
  plan:     'block',
  user:     'inline',
  skill:    'block',
  mcp:      'block',
  callout:  'block',
  section:  'block',
  divider:  'block',
  link:     'inline',
  header:   'block',    // 仅 Stage C 消费；Stage B parser 识别并 emit，renderer 侧忽略
};

const VALID_TAGS = Object.keys(TAG_PLACEMENT);

// 未闭合 `[[` 的最大耐心长度（字符）；超过即当普通文本泄出
const MAX_PENDING = 200;

// 单个 markup 整体最大长度（含 `[[` `]]`）
const MAX_MARKUP_LEN = 300;

export class MarkupStream {
  constructor() {
    this._buffer = '';   // 未 emit 的字符串（只在扫到 `[[` 之后才会积累）
  }

  /**
   * 喂入一段新 chunk，返回本次能定稿 emit 的 parts 数组
   * @param {string} delta
   * @returns {Array<{kind:string, ...}>}
   */
  feed(delta) {
    if (!delta) return [];
    this._buffer += delta;
    const parts = [];

    // 反复扫，直到 buffer 里不再含可立即定稿的段
    while (true) {
      const openIdx = this._buffer.indexOf('[[');
      if (openIdx === -1) {
        // 没有 `[[`。但若 buffer 末尾是单个 `[`，要保留（下个 chunk 可能补一个 `[` 凑成 `[[`）
        const safeLen = this._buffer.endsWith('[') ? this._buffer.length - 1 : this._buffer.length;
        if (safeLen > 0) {
          parts.push({ kind: 'text', text: this._buffer.slice(0, safeLen) });
          this._buffer = this._buffer.slice(safeLen);
        }
        break;
      }

      // `[[` 前面的部分是安全的普通文本
      if (openIdx > 0) {
        parts.push({ kind: 'text', text: this._buffer.slice(0, openIdx) });
        this._buffer = this._buffer.slice(openIdx);
      }

      // 现在 buffer 以 `[[` 开头，找闭合 `]]`
      const closeIdx = this._buffer.indexOf(']]', 2);
      if (closeIdx === -1) {
        // 未闭合。若 buffer 已超过 MAX_PENDING，当普通文本兜底
        if (this._buffer.length > MAX_PENDING) {
          parts.push({ kind: 'text', text: this._buffer });
          this._buffer = '';
        }
        // 否则等下个 chunk，保留 buffer
        break;
      }

      // 闭合！切出 `[[...]]`
      const rawMarkup = this._buffer.slice(0, closeIdx + 2);
      const inner = this._buffer.slice(2, closeIdx);   // 不含 `[[` `]]`

      // 太长的兜底：若整块超过 MAX_MARKUP_LEN，当普通文本
      if (rawMarkup.length > MAX_MARKUP_LEN) {
        parts.push({ kind: 'text', text: rawMarkup });
        this._buffer = this._buffer.slice(closeIdx + 2);
        continue;
      }

      // 解析 tag:args
      const colonIdx = inner.indexOf(':');
      let tag, argsPart;
      if (colonIdx === -1) {
        // 无 `:` — 比如 [[divider]]
        tag = inner.trim();
        argsPart = '';
      } else {
        tag = inner.slice(0, colonIdx).trim();
        argsPart = inner.slice(colonIdx + 1);
      }

      if (!VALID_TAGS.includes(tag)) {
        // 不认识的 tag，当普通文本
        parts.push({ kind: 'text', text: rawMarkup });
        this._buffer = this._buffer.slice(closeIdx + 2);
        continue;
      }

      const args = argsPart === '' ? [] : argsPart.split('|').map(s => s.trim());
      parts.push({
        kind: 'markup',
        tag,
        args,
        placement: TAG_PLACEMENT[tag],
      });
      this._buffer = this._buffer.slice(closeIdx + 2);
    }

    return parts;
  }

  /**
   * 流结束时，把 buffer 剩余的不完整内容当普通文本兜底
   * @returns {Array<{kind:string, ...}>}
   */
  flush() {
    if (!this._buffer) return [];
    const tail = this._buffer;
    this._buffer = '';
    return [{ kind: 'text', text: tail }];
  }
}
