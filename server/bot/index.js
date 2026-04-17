/**
 * 飞书 LLM 机器人入口
 * 卡片实时更新：一张卡片从思考→工具调用→最终结果全程原地更新
 */

import { initFeishu, sendCardGetId, updateCard, sendCard } from './feishu.js';
import { chat } from './llm.js';
import { getSession, updateSession, startSessionCleanup } from './session.js';
import { startChangeDetector } from './change-detector.js';
import { startPatrol } from './patrol.js';
import { enqueueMessage } from './concurrency.js';
import { getUserByOpenId, bindFeishuUser } from '../mcp/db-ops.js';
import {
  buildProgressCard,
  buildFinalCard,
  buildReplyCard,
  buildErrorCard,
} from './card-templates.js';

/**
 * 启动飞书机器人
 */
export async function startBot() {
  if (process.env.BOT_ENABLED !== 'true') {
    console.log('[Bot] BOT_ENABLED !== true，跳过启动');
    return;
  }

  startSessionCleanup();

  const feishuReady = await initFeishu(handleMessage);

  startChangeDetector();
  startPatrol();

  if (feishuReady) {
    console.log('[Bot] 飞书机器人已启动');
  } else {
    console.log('[Bot] 变更检测已启动（飞书未配置，消息功能不可用）');
  }
}

/**
 * 处理收到的飞书消息
 * 卡片生命周期：
 *   1. 模型直接回复（不用工具）→ 一张卡片完事
 *   2. 模型需要工具 → 先发"思考中"卡片 → 更新进度 → 更新为最终结果
 */
async function handleMessage(text, chatId, userId, chatType) {
  const receiveId = chatType === 'p2p' ? userId : chatId;
  const receiveIdType = chatType === 'p2p' ? 'open_id' : 'chat_id';

  // ── 绑定指令（在排队之前快速响应，密码不经过 LLM）──
  const bindMatch = text.match(/^绑定\s+(\S+)\s+(\S+)$/);
  if (bindMatch) {
    if (chatType !== 'p2p') {
      await sendCard(receiveId, receiveIdType,
        buildReplyCard('请私聊我来绑定账号，避免密码泄露~')
      );
      return;
    }
    const [, username, password] = bindMatch;
    const result = bindFeishuUser(username, password, userId);
    if (result.ok) {
      await sendCard(receiveId, receiveIdType,
        buildReplyCard(`绑定成功！你好 ${result.displayName}，以后工单有动态我会通知你。`)
      );
    } else {
      await sendCard(receiveId, receiveIdType,
        buildReplyCard(`绑定失败：${result.reason}。格式：绑定 用户名 密码`)
      );
    }
    return;
  }

  const { status } = await enqueueMessage(userId, async () => {
    // 查询绑定状态
    const boundUser = getUserByOpenId(userId);

    // ── 流式卡片状态 ──
    // 卡片仍走旧 message.patch（CardKit 改造放下一轮）
    // 节流策略：1500ms 或 80 字符强制刷新一次。8 轮工具循环最多 ~30 次 patch，紧贴上限但够用。
    let cardMessageId = null;
    let runningText = '';        // 当前轮模型说的话（chunks 累积），轮间重置
    let runningThinking = '';    // 全局思考链，跨轮累加
    let currentToolSteps = [];   // 工具步骤快照
    let lastFlushTime = 0;
    let charsSinceFlush = 0;
    let pendingTimer = null;

    const THROTTLE_MS = 1500;
    const FLUSH_AT_CHARS = 80;

    function cancelPending() {
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
    }

    async function flushCard() {
      cancelPending();
      charsSinceFlush = 0;
      lastFlushTime = Date.now();

      const card = buildProgressCard(runningText, currentToolSteps, runningThinking);
      try {
        if (cardMessageId) {
          await updateCard(cardMessageId, card);
        } else {
          cardMessageId = await sendCardGetId(receiveId, receiveIdType, card);
        }
      } catch (err) {
        console.error('[Bot] 流式卡片刷新失败:', err.message);
      }
    }

    function scheduleFlush() {
      if (pendingTimer) return;
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        flushCard().catch(() => {});
      }, THROTTLE_MS);
    }

    async function onChunk(chunk) {
      charsSinceFlush += chunk.length;
      const elapsed = Date.now() - lastFlushTime;
      if (elapsed >= THROTTLE_MS || charsSinceFlush >= FLUSH_AT_CHARS) {
        await flushCard();
      } else {
        scheduleFlush();
      }
    }

    const onProgress = async (event) => {
      switch (event.type) {
        case 'text_chunk': {
          if (!event.delta) break;
          runningText += event.delta;
          await onChunk(event.delta);
          break;
        }

        case 'thinking_chunk': {
          if (!event.delta) break;
          runningThinking += event.delta;
          await onChunk(event.delta);
          break;
        }

        case 'thinking': {
          // 兜底：若流式 chunks 没到（极少见），用一次性事件填充
          if (!runningText && event.text) runningText = event.text;
          if (!runningThinking && event.thinkingContent) runningThinking = event.thinkingContent;
          if (!cardMessageId || charsSinceFlush > 0) await flushCard();
          break;
        }

        case 'tool_start': {
          currentToolSteps = event.toolSteps || [];
          await flushCard();
          break;
        }

        case 'tool_done': {
          currentToolSteps = event.toolSteps || [];
          await flushCard();
          runningText = '';   // 下一轮 chunks 从零累积
          break;
        }

        case 'complete': {
          cancelPending();
          const card = buildFinalCard(event.text);
          try {
            if (cardMessageId) {
              await updateCard(cardMessageId, card);
            } else {
              await sendCard(receiveId, receiveIdType, card);
            }
          } catch (err) {
            console.error('[Bot] 最终卡片更新失败:', err.message);
          }
          break;
        }

        case 'direct_reply': {
          cancelPending();
          const card = buildReplyCard(event.text);
          try {
            if (cardMessageId) {
              await updateCard(cardMessageId, card);
            } else {
              await sendCard(receiveId, receiveIdType, card);
            }
          } catch (err) {
            console.error('[Bot] 直接回复卡片失败:', err.message);
          }
          break;
        }

        case 'error': {
          cancelPending();
          const card = buildErrorCard(event.text);
          try {
            if (cardMessageId) {
              await updateCard(cardMessageId, card);
            } else {
              await sendCard(receiveId, receiveIdType, card);
            }
          } catch (err) {
            console.error('[Bot] 错误卡片发送失败:', err.message);
          }
          break;
        }
      }
    };

    try {
      const { messages, toolLog } = getSession(userId);
      const { text: reply, toolSummaries } = await chat(text, messages, onProgress, boundUser, toolLog);
      updateSession(userId, text, reply, toolSummaries);
    } catch (err) {
      console.error('[Bot] 消息处理错误:', err);
      const card = buildErrorCard('抱歉，我暂时无法处理请求，请稍后再试。');
      if (cardMessageId) {
        await updateCard(cardMessageId, card);
      } else {
        await sendCard(receiveId, receiveIdType, card);
      }
    }
  });

  // 背压：队列已满时回复友好提示
  if (status === 'backpressure') {
    await sendCard(receiveId, receiveIdType,
      buildReplyCard('我还在处理你之前的消息，稍等一下~')
    );
  }
}
