/**
 * 共享 Agent 循环（流式 + tool use）
 *
 * 抽自 llm.js 的 chat() 和 notify-llm.js 的 runAgent()，统一以下行为：
 *   - SDK 流式调用 + 思考链增量回调
 *   - tool_use 循环（最多 maxRounds 轮）
 *   - 每轮 assistant 完整 content 入 messages 历史（保留 thinking blocks，
 *     满足 interleaved thinking 的顺序约束）
 *   - max_tokens 截断和轮数耗尽的优雅退化
 *
 * 调用方（chat / notify-llm）通过回调 hook 进度事件、动态构建 system prompt。
 */

import { client, DEFAULT_MODEL, INTERLEAVED_THINKING_HEADERS } from './anthropic-client.js';

const ERROR_TEXT = '抱歉，我暂时无法处理请求，请稍后再试。';

/** 从 content 数组提取所有 text blocks 拼成字符串 */
function extractText(content) {
  if (!Array.isArray(content)) return '';
  return content.filter(b => b.type === 'text').map(b => b.text).join('\n');
}

/**
 * 跑一次 agent 循环
 *
 * @param {object} opts
 * @param {string} [opts.model] - 模型名，默认 DEFAULT_MODEL
 * @param {number} opts.maxTokens
 * @param {number} opts.maxRounds - tool use 最大轮数
 * @param {Function} opts.buildSystem - (round, ctx) => string | object[]，
 *                                       支持每轮重建（chat 注入 toolLog 用）
 * @param {Array} opts.initialMessages - 初始 messages 历史（不含本轮 user）
 * @param {Array} opts.tools - tool definitions（可空）
 * @param {object} [opts.thinking] - 如 { type: 'enabled', budget_tokens: 500 }
 * @param {boolean} [opts.interleaved=false] - 是否开启交错思考
 * @param {Function} opts.executeTool - (name, input) => Promise<any>
 *
 * @param {Function} [opts.onTextChunk]    - (delta, round) => void
 * @param {Function} [opts.onThinkingChunk]- (delta, round) => void
 * @param {Function} [opts.onRoundStart]   - (round) => void
 * @param {Function} [opts.onToolStart]    - (toolSteps) => Promise|void
 * @param {Function} [opts.onToolDone]     - (toolSteps) => Promise|void
 *
 * @returns {Promise<{ text, toolSteps, toolSummaries, truncated, exhausted }>}
 */
export async function runAgentLoop(opts) {
  const {
    model = DEFAULT_MODEL,
    maxTokens,
    maxRounds,
    buildSystem,
    initialMessages,
    tools = [],
    thinking,
    interleaved = false,
    executeTool,
    onTextChunk,
    onThinkingChunk,
    onRoundStart,
    onToolStart,
    onToolDone,
  } = opts;

  const messages = [...initialMessages];
  const toolSteps = [];
  const toolSummaries = [];

  for (let round = 0; round < maxRounds; round++) {
    onRoundStart?.(round);

    const body = {
      model,
      max_tokens: maxTokens,
      system: buildSystem(round, { messages, toolSummaries }),
      messages,
    };
    if (tools.length > 0) body.tools = tools;
    if (thinking) body.thinking = thinking;

    const requestOpts = interleaved ? { headers: INTERLEAVED_THINKING_HEADERS } : undefined;

    const stream = client.messages.stream(body, requestOpts);

    // 诊断计数器（每轮独立）
    let textCount = 0, thinkingCount = 0;

    if (onTextChunk) {
      stream.on('text', (delta) => {
        textCount++;
        onTextChunk(delta, round);
      });
    }
    if (onThinkingChunk) {
      stream.on('streamEvent', (evt) => {
        if (evt.type === 'content_block_delta' && evt.delta?.type === 'thinking_delta') {
          thinkingCount++;
          onThinkingChunk(evt.delta.thinking, round);
        }
      });
    }

    let final;
    try {
      final = await stream.finalMessage();
    } catch (err) {
      console.error('[AgentLoop] stream 失败:', err.message);
      throw err;
    }

    const blockTypes = final.content.map(b => b.type).join(',');
    const cacheRead = final.usage?.cache_read_input_tokens || 0;
    const cacheWrite = final.usage?.cache_creation_input_tokens || 0;
    console.log(
      `[AgentLoop] round=${round} blocks=[${blockTypes}] ` +
      `chunks(text=${textCount}, thinking=${thinkingCount}) ` +
      `tokens(in=${final.usage?.input_tokens}, out=${final.usage?.output_tokens}, ` +
      `cacheR=${cacheRead}, cacheW=${cacheWrite}) ` +
      `stop=${final.stop_reason} interleaved=${interleaved}`
    );

    // 完整 content 入历史（保留 thinking + tool_use 顺序，满足 interleaved 约束）
    messages.push({ role: 'assistant', content: final.content });

    const hasToolUse = final.content.some(b => b.type === 'tool_use');

    // ── max_tokens 截断 ──
    if (final.stop_reason === 'max_tokens') {
      const partial = extractText(final.content);
      const text = partial ? partial + '\n\n_(回复过长被截断)_' : ERROR_TEXT;
      return { text, toolSteps, toolSummaries, truncated: true, final };
    }

    // ── 终止：模型不再调工具 ──
    if (final.stop_reason === 'end_turn' || !hasToolUse) {
      const text = extractText(final.content) || ERROR_TEXT;
      return { text, toolSteps, toolSummaries, final };
    }

    // ── 执行工具 ──
    const toolUseBlocks = final.content.filter(b => b.type === 'tool_use');
    // 用 block.id 唯一标识每个 step；name 不唯一（同名工具多次调用时会碰撞）
    const newSteps = toolUseBlocks.map(b => ({ name: b.name, blockId: b.id, done: false }));
    toolSteps.push(...newSteps);

    if (onToolStart) await onToolStart(toolSteps);

    const toolResults = [];
    for (const block of toolUseBlocks) {
      let result;
      let isError = false;
      try {
        const out = await executeTool(block.name, block.input);
        result = JSON.stringify(out, null, 2);
      } catch (err) {
        result = `工具执行失败: ${err.message}`;
        isError = true;
      }

      const tr = {
        type: 'tool_result',
        tool_use_id: block.id,
        content: result,
      };
      if (isError) tr.is_error = true;
      toolResults.push(tr);

      // 工具调用摘要（给 toolLog 用）
      const inputBrief = JSON.stringify(block.input).slice(0, 80);
      toolSummaries.push(`${block.name}(${inputBrief}) → ${isError ? '失败' : '成功'}`);

      // 用 block.id 精确定位（同名工具多次调用也能正确标记）
      const step = toolSteps.find(s => s.blockId === block.id);
      if (step) step.done = true;
    }

    if (onToolDone) await onToolDone(toolSteps);

    messages.push({ role: 'user', content: toolResults });
  }

  // 轮数耗尽
  return {
    text: '查询过程过于复杂，请尝试更简单的问题。',
    toolSteps,
    toolSummaries,
    exhausted: true,
  };
}

export { ERROR_TEXT };
