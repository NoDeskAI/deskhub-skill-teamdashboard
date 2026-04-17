/**
 * 飞书 LLM 机器人入口
 *
 * 卡片流式生命周期（CardKit）：
 *   1. 用户发消息
 *   2. 第一个 chunk 到达 → createCardEntity + sendCardById（拿 card_id）
 *   3. thinking_chunks → 插入 thinking_panel + 流式推 thinking_text
 *   4. 首个 text_chunk → 收起 thinking_panel
 *   5. tool_start → 插入 tool_panel + 推 tool_progress
 *   6. tool_done → 更新 tool_progress（✅ 替换 ⏳）
 *   7. text_chunks → 流式推 main_text
 *   8. complete → 收起 tool_panel + closeStreamingMode
 *
 * 节流：per-element 500ms 或 50 字符强制 flush
 */

import {
  initFeishu,
  createAndSendCard,
  createCardEntity,
  sendCardById,
  streamCardText,
  insertCardElements,
  patchCardElement,
  closeStreamingMode,
} from './feishu.js';
import { chat } from './llm.js';
import { getSession, updateSession, startSessionCleanup } from './session.js';
import { startChangeDetector } from './change-detector.js';
import { startPatrol } from './patrol.js';
import { enqueueMessage } from './concurrency.js';
import { getUserByOpenId, bindFeishuUser } from '../mcp/db-ops.js';
import {
  buildChatCardInitial,
  buildThinkingPanel,
  buildToolPanel,
  buildToolPanelDonePatch,
  buildToolProgressMarkdown,
  buildSimpleCard,
  THINKING_PANEL_DONE_PATCH,
} from './card-templates.js';

const THROTTLE_MS = 300;
const FLUSH_AT_CHARS = 30;

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

// ============================================================
//  ChatCardStreamer — 单条消息处理过程中的卡片状态机
// ============================================================

class ChatCardStreamer {
  /**
   * @param {string} receiveId
   * @param {string} receiveIdType
   * @param {object} [opts]
   * @param {string} [opts.presetCardId] - 收到消息时已预创建的 cardId（TTFP 优化）
   * @param {string} [opts.presetMessageId]
   */
  constructor(receiveId, receiveIdType, { presetCardId = null, presetMessageId = null } = {}) {
    this.receiveId = receiveId;
    this.receiveIdType = receiveIdType;
    this.cardId = presetCardId;
    this.messageId = presetMessageId;

    this.runningText = '';        // 当前轮答案，轮间重置
    this.runningThinking = '';    // 全局思考链
    this.currentToolSteps = [];

    // ── Promise 备忘锁，防止并发 chunk 重复触发 insert/patch ──
    // 预创建场景：cardId 已就绪，把 _cardPromise 设为已 resolve，让 ensureCardCreated 直接返回
    this._cardPromise = presetCardId ? Promise.resolve() : null;
    this._thinkingPanelPromise = null;
    this._toolPanelPromise = null;
    this._thinkingCollapsePromise = null;

    // ── per-card 顺序队列：所有 CardKit 调用串行化，保证 sequence 接收顺序 ──
    this._opQueue = Promise.resolve();

    // per-element 节流：elementId -> { lastFlushTime, lastFlushedLen, timer }
    this.flushState = new Map();
  }

  /** 把一段操作排进串行队列，保证 sequence 单调到达 */
  _enqueue(label, fn) {
    const next = this._opQueue.then(fn).catch(err => {
      console.error(`[Bot/Stream] ${label} 失败:`, err?.message || err);
    });
    this._opQueue = next.catch(() => {});  // 单根链不被错误中断
    return next;
  }

  /**
   * 备忘锁辅助：promise 失败时自动清空，下个调用可重试，避免死锁
   */
  _memoize(slot, factory) {
    if (this[slot]) return this[slot];
    const p = factory().catch(err => {
      // 失败时清空备忘，下次调用从头来过
      if (this[slot] === p) this[slot] = null;
      throw err;
    });
    this[slot] = p;
    return p;
  }

  async ensureCardCreated() {
    return this._memoize('_cardPromise', async () => {
      const cid = await createCardEntity(buildChatCardInitial());
      if (!cid) throw new Error('createCardEntity 返回 null');
      this.cardId = cid;
      this.messageId = await sendCardById(this.receiveId, this.receiveIdType, cid);
      console.log(`[Bot/Stream] 卡片已创建 cardId=${cid}`);
    });
  }

  async ensureThinkingPanel() {
    return this._memoize('_thinkingPanelPromise', async () => {
      await this.ensureCardCreated();
      await this._enqueue('insert thinking_panel', async () => {
        await insertCardElements(this.cardId, buildThinkingPanel(), {
          type: 'insert_before',
          targetElementId: 'main_text',
        });
        console.log('[Bot/Stream] thinking_panel 已插入');
      });
    });
  }

  async ensureToolPanel() {
    return this._memoize('_toolPanelPromise', async () => {
      await this.ensureCardCreated();
      await this._enqueue('insert tool_panel', async () => {
        await insertCardElements(this.cardId, buildToolPanel(), {
          type: 'insert_before',
          targetElementId: 'main_text',
        });
        console.log('[Bot/Stream] tool_panel 已插入');
      });
    });
  }

  async collapseThinking() {
    if (!this._thinkingPanelPromise) return;
    return this._memoize('_thinkingCollapsePromise', async () => {
      await this._thinkingPanelPromise;  // 等面板真正存在
      await this._enqueue('collapse thinking_panel', async () => {
        await patchCardElement(this.cardId, 'thinking_panel', THINKING_PANEL_DONE_PATCH);
        console.log('[Bot/Stream] thinking_panel 已收起');
      });
    });
  }

  // ── 节流推送 ──
  _state(elementId) {
    let st = this.flushState.get(elementId);
    if (!st) {
      st = { lastFlushTime: 0, lastFlushedLen: 0, timer: null };
      this.flushState.set(elementId, st);
    }
    return st;
  }

  scheduleFlush(elementId, getContent) {
    const st = this._state(elementId);
    const content = getContent();
    const newChars = content.length - st.lastFlushedLen;
    const elapsed = Date.now() - st.lastFlushTime;

    if (elapsed >= THROTTLE_MS || newChars >= FLUSH_AT_CHARS) {
      this.flushElement(elementId, content);  // fire-and-forget；队列内串行
      return;
    }

    if (!st.timer) {
      const wait = Math.max(0, THROTTLE_MS - elapsed);
      st.timer = setTimeout(() => {
        st.timer = null;
        this.flushElement(elementId, getContent());
      }, wait);
    }
  }

  flushElement(elementId, content) {
    const st = this._state(elementId);
    if (st.timer) { clearTimeout(st.timer); st.timer = null; }
    st.lastFlushTime = Date.now();
    st.lastFlushedLen = content.length;

    return this._enqueue(`stream ${elementId}`, async () => {
      // 等卡片真正创建完毕（trailing flush 可能在 cardId 就绪前触发）
      await this.ensureCardCreated();
      if (!this.cardId) return;  // 创建彻底失败，丢弃更新
      await streamCardText(this.cardId, elementId, content);
    });
  }

  cancelAllPending() {
    for (const st of this.flushState.values()) {
      if (st.timer) { clearTimeout(st.timer); st.timer = null; }
    }
  }

  // ── 事件处理 ──

  onThinkingChunk(delta) {
    this.runningThinking += delta;
    // ensureThinkingPanel 已 promise 备忘，并发安全
    this.ensureThinkingPanel().catch(() => {});
    this.scheduleFlush('thinking_text', () => this.runningThinking);
  }

  onTextChunk(delta) {
    this.runningText += delta;
    this.ensureCardCreated().catch(() => {});
    // 首个答案 chunk 触发收起思考面板（队列内自动 await 面板存在）
    if (this._thinkingPanelPromise && !this._thinkingCollapsePromise) {
      this.collapseThinking();
    }
    this.scheduleFlush('main_text', () => this.runningText);
  }

  async onToolStart(toolSteps) {
    this.currentToolSteps = toolSteps || [];
    this.ensureToolPanel().catch(() => {});
    this.collapseThinking();
    this.flushElement('tool_progress', buildToolProgressMarkdown(this.currentToolSteps));
  }

  async onToolDone(toolSteps) {
    this.currentToolSteps = toolSteps || [];
    if (this._toolPanelPromise) {
      this.flushElement('tool_progress', buildToolProgressMarkdown(this.currentToolSteps));
    }
    this.runningText = '';   // 下一轮文本重新累积
  }

  async onComplete(finalText) {
    this.cancelAllPending();
    if (!this.cardId) {
      // 整个流式过程没产生任何 chunks（极少见），降级一次性发送
      await createAndSendCard(this.receiveId, this.receiveIdType,
        buildSimpleCard(finalText, { level: 'info' }));
      return;
    }
    this.collapseThinking();
    this.flushElement('main_text', finalText);
    if (this._toolPanelPromise) {
      this._enqueue('collapse tool_panel', () =>
        patchCardElement(this.cardId, 'tool_panel',
          buildToolPanelDonePatch(this.currentToolSteps.length))
      );
    }
    this._enqueue('closeStreamingMode', () => closeStreamingMode(this.cardId));
    await this._opQueue;   // 等所有排队操作完成
  }

  async onDirectReply(finalText) {
    this.cancelAllPending();
    if (!this.cardId) {
      await createAndSendCard(this.receiveId, this.receiveIdType,
        buildSimpleCard(finalText, { level: 'info' }));
      return;
    }
    this.collapseThinking();
    this.flushElement('main_text', finalText);
    this._enqueue('closeStreamingMode', () => closeStreamingMode(this.cardId));
    await this._opQueue;
  }

  async onError(text) {
    this.cancelAllPending();
    if (this.cardId) {
      this.flushElement('main_text', text);
      this._enqueue('closeStreamingMode', () => closeStreamingMode(this.cardId));
      await this._opQueue;
    } else {
      await createAndSendCard(this.receiveId, this.receiveIdType,
        buildSimpleCard(text, { level: 'error' }));
    }
  }
}

// ============================================================
//  消息处理
// ============================================================

async function handleMessage(text, chatId, userId, chatType) {
  const receiveId = chatType === 'p2p' ? userId : chatId;
  const receiveIdType = chatType === 'p2p' ? 'open_id' : 'chat_id';

  // ── 绑定指令（不经过 LLM）──
  const bindMatch = text.match(/^绑定\s+(\S+)\s+(\S+)$/);
  if (bindMatch) {
    if (chatType !== 'p2p') {
      await createAndSendCard(receiveId, receiveIdType,
        buildSimpleCard('请私聊我来绑定账号，避免密码泄露~', { level: 'warn' }));
      return;
    }
    const [, username, password] = bindMatch;
    const result = bindFeishuUser(username, password, userId);
    if (result.ok) {
      await createAndSendCard(receiveId, receiveIdType,
        buildSimpleCard(`绑定成功！你好 ${result.displayName}，以后工单有动态我会通知你。`,
          { level: 'success' }));
    } else {
      await createAndSendCard(receiveId, receiveIdType,
        buildSimpleCard(`绑定失败：${result.reason}。\n\n格式：\`绑定 用户名 密码\``,
          { level: 'warn' }));
    }
    return;
  }

  const { status } = await enqueueMessage(userId, async () => {
    const boundUser = getUserByOpenId(userId);

    // ── TTFP 优化：消息进入处理前，先把空卡片推到飞书 ──
    // 用户在 LLM 响应前（2-7 秒 TTFT）就能看到"小合正在思考..."摘要，立刻有反馈。
    // 失败则降级到 lazy 创建（首个 chunk 触发，与之前行为一致）。
    let presetCardId = null;
    let presetMessageId = null;
    try {
      const { cardId, messageId } = await createAndSendCard(
        receiveId, receiveIdType, buildChatCardInitial()
      );
      presetCardId = cardId;
      presetMessageId = messageId;
      if (cardId) console.log(`[Bot/Stream] 卡片预创建 cardId=${cardId}`);
    } catch (err) {
      console.warn('[Bot] 卡片预创建失败，降级到首个 chunk 触发:', err.message);
    }

    const streamer = new ChatCardStreamer(receiveId, receiveIdType, {
      presetCardId,
      presetMessageId,
    });

    const onProgress = async (event) => {
      try {
        switch (event.type) {
          case 'text_chunk':
            if (event.delta) await streamer.onTextChunk(event.delta);
            break;
          case 'thinking_chunk':
            if (event.delta) await streamer.onThinkingChunk(event.delta);
            break;
          case 'tool_start':
            await streamer.onToolStart(event.toolSteps);
            break;
          case 'tool_done':
            await streamer.onToolDone(event.toolSteps);
            break;
          case 'complete':
            await streamer.onComplete(event.text);
            break;
          case 'direct_reply':
            await streamer.onDirectReply(event.text);
            break;
          case 'error':
            await streamer.onError(event.text);
            break;
          // 'thinking' 一次性事件被流式 chunks 取代，忽略
        }
      } catch (err) {
        console.error(`[Bot] onProgress(${event.type}) 错误:`, err.message);
      }
    };

    try {
      const { messages, toolLog } = getSession(userId);
      const { text: reply, toolSummaries } = await chat(text, messages, onProgress, boundUser, toolLog);
      updateSession(userId, text, reply, toolSummaries);
    } catch (err) {
      console.error('[Bot] 消息处理错误:', err);
      await streamer.onError('抱歉，我暂时无法处理请求，请稍后再试。').catch(() => {});
    }
  });

  if (status === 'backpressure') {
    await createAndSendCard(receiveId, receiveIdType,
      buildSimpleCard('我还在处理你之前的消息，稍等一下~', { level: 'info' }));
  }
}
