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

const TIMEOUT_MS = 10000;      // 给大 thinking 够用（长思考 795 字的时候 4s 不够）
const MAX_SUMMARY_TOKENS = 800; // Anthropic 协议 max_tokens 包含 thinking，给足空间让它想完 + 输出
const THINKING_BUDGET = 500;    // thinking 独立预算

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

  // 第一人称 小合 视角 prompt：避免模型把 thinking 当成外部对象描述
  const prompt = `你是小合，一个飞书聊天机器人。下面 <thinking> 里是你刚才自己内心的一段思考（推理过程）。

请用**≤20 字**一句中文、**以"我"开头**，第一人称自述你刚才想明白了什么 / 决定做什么。直接输出这一句话，不要写"这段思考"、"总结："、"我认为"等套话，不要用引号包，不要解释。

示例：
- 思考涉及查工单 → "我先翻翻工单看看"
- 思考评测数据 → "我算了下，方案 B 差点意思"
- 思考用户意图 → "用户应该是想定稿了"
- 思考错误处理 → "不对，我再试一次"
- 思考对比分析 → "P-012 比 P-015 更紧"

<thinking>
${rawThinking.slice(0, 2000)}
</thinking>`;

  const t0 = Date.now();
  try {
    const res = await client.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: MAX_SUMMARY_TOKENS,
      // 必须显式开启 thinking（即使不用）。不传的话 MiniMax 退化到 OpenAI 兼容模式
      // 只返 reasoning_content 不返 text，我们就拿不到摘要。memory 里踩过这个坑。
      thinking: { type: 'enabled', budget_tokens: THINKING_BUDGET },
      messages: [{ role: 'user', content: prompt }],
    }, { signal: controller.signal });

    const elapsed = Date.now() - t0;
    const blockTypes = Array.isArray(res.content) ? res.content.map(b => b.type).join(',') : 'none';
    const textBlocks = res.content?.filter(b => b.type === 'text') || [];
    let text = textBlocks.map(b => b.text).join('').trim();
    let fromThinking = false;

    // 兜底：如果没有 text 块（MiniMax 有时只返 thinking），尝试从 thinking 里抽
    // 注意：thinking 通常是"我要先弄清用户意图..."这种元评论，不是总结本身，
    //      所以兜底的质量会比较差。理想情况还是靠 text 块。
    if (!text) {
      const thinkingBlocks = res.content?.filter(b => b.type === 'thinking') || [];
      const raw = thinkingBlocks.map(b => b.thinking || '').join('').trim();
      // 启发式：优先找"我..."开头的句子；否则取最后一句
      const sentences = raw.split(/[。！？\n]/).map(s => s.trim()).filter(Boolean);
      const iSentence = sentences.slice().reverse().find(s => /^我/.test(s));
      text = iSentence || sentences.pop() || '';
      fromThinking = true;
      if (text) {
        console.log(`[Bot/Summary] text 块空，从 thinking 兜底抽："${text.slice(0, 30)}"`);
      }
    }

    if (!text) {
      console.warn(`[Bot/Summary] 响应 text 和 thinking 都为空，${elapsed}ms blocks=[${blockTypes}]`);
      return null;
    }

    const firstLine = text.split('\n')[0].trim();
    const final = firstLine.length > 24 ? firstLine.slice(0, 24) + '…' : firstLine;
    console.log(`[Bot/Summary] ${fromThinking ? '兜底' : '成功'} ${elapsed}ms blocks=[${blockTypes}] → "${final}"`);
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
