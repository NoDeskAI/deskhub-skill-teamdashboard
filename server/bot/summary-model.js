/**
 * 思考摘要小模型调用
 *
 * 目的：拿一段原始 thinking 内容，让 MiniMax-M2.7-highspeed 一句 ≤20 字概括结论。
 * 用于思考胶囊收起后的标题（● 思考 2.1s · {摘要}）。
 *
 * 设计：
 *  - 复用 anthropic-client.js 的同一个 client + SUMMARY_MODEL env 配置
 *  - 不传 thinking 参数 = 纯推理模式（快）
 *  - AbortController 1.5s timeout；失败返 null，调用侧兜底显示"● 思考 X.Xs"
 *  - fire-and-forget：不进 ChatCardStreamer._opQueue，结果回来再 enqueue patch
 */

import { client, SUMMARY_MODEL } from './anthropic-client.js';

const TIMEOUT_MS = 4000;
const MAX_SUMMARY_TOKENS = 50;

/**
 * @param {string} rawThinking - 累积的 thinking 内容（跨 chunk 已拼好）
 * @returns {Promise<string|null>} 摘要文本，失败/超时返 null
 */
export async function summarizeThinking(rawThinking) {
  if (!rawThinking || rawThinking.trim().length < 10) {
    console.log(`[Bot/Summary] 跳过（内容过短 ${rawThinking?.length || 0} 字）`);
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const t0 = Date.now();
  try {
    const res = await client.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: MAX_SUMMARY_TOKENS,
      // 必须显式开启 thinking（即使不用）。不传的话 MiniMax 退化到 OpenAI 兼容模式
      // 只返 reasoning_content 不返 text，我们就拿不到摘要。memory 里踩过这个坑。
      thinking: { type: 'enabled', budget_tokens: 500 },
      messages: [
        {
          role: 'user',
          content: '用 ≤20 字一句中文概括这段思考的结论，直接输出不要引号不要前缀：\n\n' + rawThinking.slice(0, 2000),
        },
      ],
    }, { signal: controller.signal });

    const elapsed = Date.now() - t0;
    const blockTypes = Array.isArray(res.content) ? res.content.map(b => b.type).join(',') : 'none';
    const textBlocks = res.content?.filter(b => b.type === 'text') || [];
    let text = textBlocks.map(b => b.text).join('').trim();

    // 兜底：如果没有 text 块（MiniMax 有时只返 thinking），从 thinking 里抽末尾几十字
    if (!text) {
      const thinkingBlocks = res.content?.filter(b => b.type === 'thinking') || [];
      const raw = thinkingBlocks.map(b => b.thinking || '').join('').trim();
      // thinking 通常是推理过程，取最后一句（到 "所以" / "结论" / 句号后）
      const lastSentence = raw.split(/[。！？\n]/).filter(Boolean).pop() || '';
      text = lastSentence.trim();
      if (text) {
        console.log(`[Bot/Summary] text 块空，从 thinking 末段兜底抽："${text.slice(0, 30)}..."`);
      }
    }

    if (!text) {
      console.warn(`[Bot/Summary] 响应 text 和 thinking 都为空，${elapsed}ms blocks=[${blockTypes}]`);
      return null;
    }

    const firstLine = text.split('\n')[0].trim();
    const final = firstLine.length > 24 ? firstLine.slice(0, 24) + '…' : firstLine;
    console.log(`[Bot/Summary] 成功 ${elapsed}ms blocks=[${blockTypes}] → "${final}"`);
    return final;
  } catch (err) {
    const elapsed = Date.now() - t0;
    if (err.name === 'AbortError') {
      console.warn(`[Bot/Summary] 超时 aborted ${elapsed}ms（TIMEOUT_MS=${TIMEOUT_MS}）`);
    } else {
      console.warn(`[Bot/Summary] 失败 ${elapsed}ms: ${err.message}`);
      if (err.status) console.warn(`  HTTP ${err.status}`, err.error);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}
