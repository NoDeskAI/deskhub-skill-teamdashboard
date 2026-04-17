/**
 * 飞书 SDK 封装
 * WSClient 长连接接收消息（无需公网 IP）
 * Client API 发送消息 + CardKit v1（卡片实体 + 组件级流式更新）
 */

import * as lark from '@larksuiteoapi/node-sdk';
import crypto from 'crypto';

let client = null;
let botOpenId = null;

// ── CardKit sequence 管理 ──
// 飞书要求每个 card_id 的更新 sequence 严格递增
const cardSequences = new Map();

function nextSeq(cardId) {
  const cur = (cardSequences.get(cardId) || 0) + 1;
  cardSequences.set(cardId, cur);
  return cur;
}

function uuid() {
  return crypto.randomUUID();
}

// 卡片实体最长 14 天有效，定时清理 sequence 表防止内存泄漏
setInterval(() => {
  // 简单粗暴：sequence 超过 1000 的 card 清理掉（流式聊天不会用到这么多）
  for (const [cid, seq] of cardSequences.entries()) {
    if (seq > 1000) cardSequences.delete(cid);
  }
}, 60 * 60 * 1000);  // 每小时

// 消息去重（message_id / event_id 级别，防飞书事件重发）
// per-user 串行化由 concurrency.js 的 mutex 负责
const recentMessageIds = new Set();
const MESSAGE_DEDUP_TTL = 60000;

/**
 * 初始化飞书客户端并启动消息监听
 * @param {Function} onMessage - 回调: (text, chatId, userId, chatType) => Promise<void>
 */
export async function initFeishu(onMessage) {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    console.warn('[Bot/Feishu] FEISHU_APP_ID 或 FEISHU_APP_SECRET 未配置，跳过飞书初始化');
    return false;
  }

  // API Client（发送消息用）
  client = new lark.Client({
    appId,
    appSecret,
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });

  // 获取机器人自身信息（用于判断群聊中是否被 @）
  try {
    const res = await client.request({
      method: 'GET',
      url: 'https://open.feishu.cn/open-apis/bot/v3/info',
    });
    botOpenId = res?.data?.bot?.open_id || res?.bot?.open_id || null;
    if (botOpenId) {
      console.log(`[Bot/Feishu] 机器人 open_id: ${botOpenId}`);
    } else {
      console.warn('[Bot/Feishu] 获取 bot open_id 为空，群聊 @判断可能不准');
    }
  } catch (err) {
    console.warn('[Bot/Feishu] 获取机器人信息失败:', err.message, '（不影响私聊功能）');
  }

  // 事件处理器
  const eventDispatcher = new lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data) => {
      try {
        await handleMessageEvent(data, onMessage);
      } catch (err) {
        console.error('[Bot/Feishu] 消息处理错误:', err);
      }
    },
  });

  // WSClient 长连接（无需公网 IP）
  const wsClient = new lark.WSClient({
    appId,
    appSecret,
    loggerLevel: lark.LoggerLevel.info,
  });

  await wsClient.start({ eventDispatcher });
  console.log('[Bot/Feishu] WSClient 长连接已建立');
  return true;
}

/**
 * 处理收到的消息事件
 */
async function handleMessageEvent(data, onMessage) {
  const message = data?.message;
  if (!message) return;

  // 调试：打印消息标识，排查重复问题
  const msgId = message.message_id;
  const eventId = data?.header?.event_id;
  console.log(`[Bot/Dedup] 收到消息 msgId=${msgId} eventId=${eventId} text=${message.content?.slice(0, 50)}`);

  // 消息去重：优先用 message_id，备用 event_id
  const dedupKey = msgId || eventId;
  if (dedupKey && recentMessageIds.has(dedupKey)) {
    console.log(`[Bot/Dedup] 跳过重复 key=${dedupKey}`);
    return;
  }
  if (dedupKey) {
    recentMessageIds.add(dedupKey);
    setTimeout(() => recentMessageIds.delete(dedupKey), MESSAGE_DEDUP_TTL);
  }

  // 只处理文本消息
  const msgType = message.message_type;
  if (msgType !== 'text') return;

  const chatType = message.chat_type;   // 'p2p' | 'group'
  const chatId = message.chat_id;
  const userId = data.sender?.sender_id?.open_id;

  // 解析文本内容
  let content;
  try {
    content = JSON.parse(message.content);
  } catch {
    return;
  }
  let text = content?.text || '';

  // 群聊：必须 @机器人才响应
  if (chatType === 'group') {
    const mentions = message.mentions || [];
    const mentionedBot = mentions.some(m => m.id?.open_id === botOpenId);
    if (!mentionedBot) return;

    // 去掉 @mention 标记
    for (const m of mentions) {
      text = text.replace(m.key || '', '').trim();
    }
  }

  text = text.trim();
  if (!text) return;

  await onMessage(text, chatId, userId, chatType);
}

/**
 * 发送文本消息
 */
export async function sendText(receiveId, receiveIdType, text) {
  if (!client) return;
  try {
    await client.im.v1.message.create({
      params: { receive_id_type: receiveIdType },
      data: {
        receive_id: receiveId,
        msg_type: 'text',
        content: JSON.stringify({ text }),
      },
    });
  } catch (err) {
    console.error('[Bot/Feishu] 发送文本失败:', err.message);
  }
}

// ============================================================
//  CardKit v1（卡片实体 + 组件级流式更新）
//
//  关键概念：
//  - 卡片实体（card_id）独立于消息存在，14 天有效
//  - streaming_mode 下文本更新走打字机效果，不计 QPS 上限
//  - 所有更新需带 sequence（严格递增）和 uuid（幂等）
// ============================================================

/**
 * 创建卡片实体
 * @param {object} cardJson - 完整 card JSON 2.0 结构
 * @returns {Promise<string|null>} card_id
 */
export async function createCardEntity(cardJson) {
  if (!client) return null;
  try {
    const res = await client.cardkit.v1.card.create({
      data: {
        type: 'card_json',
        data: JSON.stringify(cardJson),
      },
    });
    const cardId = res?.data?.card_id || null;
    if (!cardId) {
      console.error('[Bot/Feishu] 创建卡片实体失败：返回 card_id 为空', res);
    }
    return cardId;
  } catch (err) {
    console.error('[Bot/Feishu] 创建卡片实体失败:', err.message);
    return null;
  }
}

/**
 * 发送消息引用已创建的卡片实体
 * @param {string} receiveId - chat_id 或 open_id
 * @param {string} receiveIdType - 'chat_id' | 'open_id'
 * @param {string} cardId
 * @returns {Promise<string|null>} message_id
 */
export async function sendCardById(receiveId, receiveIdType, cardId) {
  if (!client || !cardId) return null;
  try {
    const res = await client.im.v1.message.create({
      params: { receive_id_type: receiveIdType },
      data: {
        receive_id: receiveId,
        msg_type: 'interactive',
        content: JSON.stringify({ type: 'card', data: { card_id: cardId } }),
      },
    });
    return res?.data?.message_id || null;
  } catch (err) {
    console.error('[Bot/Feishu] 发送卡片实体失败:', err.message);
    return null;
  }
}

/**
 * 一站式：创建卡片实体并发送消息
 * @returns {Promise<{ cardId: string|null, messageId: string|null }>}
 */
export async function createAndSendCard(receiveId, receiveIdType, cardJson) {
  const cardId = await createCardEntity(cardJson);
  if (!cardId) return { cardId: null, messageId: null };
  const messageId = await sendCardById(receiveId, receiveIdType, cardId);
  return { cardId, messageId };
}

/**
 * 流式更新文本组件内容（打字机效果）
 * 适用 plain_text 和 markdown 组件。需 streaming_mode 开启才能拿到打字机效果。
 * 平台自动算 diff：新文本若是旧文本前缀超集，逐字渲染；否则瞬时替换。
 * @param {string} cardId
 * @param {string} elementId
 * @param {string} content - 全量文本
 */
export async function streamCardText(cardId, elementId, content) {
  if (!client || !cardId || !elementId) return false;
  try {
    await client.cardkit.v1.cardElement.content({
      path: { card_id: cardId, element_id: elementId },
      data: {
        uuid: uuid(),
        content,
        sequence: nextSeq(cardId),
      },
    });
    return true;
  } catch (err) {
    console.error(`[Bot/Feishu] 流式推文本失败 (${elementId}):`, err.message);
    return false;
  }
}

/**
 * 在指定组件前/后插入新组件
 * @param {string} cardId
 * @param {object[]} elements - 组件 JSON 数组
 * @param {object} opts
 * @param {'insert_before'|'insert_after'|'append'} opts.type
 * @param {string} [opts.targetElementId] - type 不为 append 时必填
 */
export async function insertCardElements(cardId, elements, { type = 'append', targetElementId } = {}) {
  if (!client || !cardId) return false;
  try {
    await client.cardkit.v1.cardElement.create({
      path: { card_id: cardId },
      data: {
        uuid: uuid(),
        type,
        target_element_id: targetElementId,
        sequence: nextSeq(cardId),
        elements: JSON.stringify(elements),
      },
    });
    return true;
  } catch (err) {
    console.error(`[Bot/Feishu] 插入组件失败 (${type}@${targetElementId || 'append'}):`, err.message);
    return false;
  }
}

/**
 * 局部更新组件配置（partial merge）
 * 例如收起折叠面板：patchCardElement(cardId, 'thinking_panel', { expanded: false })
 */
export async function patchCardElement(cardId, elementId, partial) {
  if (!client || !cardId || !elementId) return false;
  try {
    await client.cardkit.v1.cardElement.patch({
      path: { card_id: cardId, element_id: elementId },
      data: {
        uuid: uuid(),
        sequence: nextSeq(cardId),
        partial_element: JSON.stringify(partial),
      },
    });
    return true;
  } catch (err) {
    console.error(`[Bot/Feishu] patch 组件失败 (${elementId}):`, err.message);
    return false;
  }
}

/**
 * 全量更新组件
 */
export async function updateCardElement(cardId, elementId, element) {
  if (!client || !cardId || !elementId) return false;
  try {
    await client.cardkit.v1.cardElement.update({
      path: { card_id: cardId, element_id: elementId },
      data: {
        uuid: uuid(),
        sequence: nextSeq(cardId),
        element: JSON.stringify(element),
      },
    });
    return true;
  } catch (err) {
    console.error(`[Bot/Feishu] 全量更新组件失败 (${elementId}):`, err.message);
    return false;
  }
}

/**
 * 删除组件
 */
export async function deleteCardElement(cardId, elementId) {
  if (!client || !cardId || !elementId) return false;
  try {
    await client.cardkit.v1.cardElement.delete({
      path: { card_id: cardId, element_id: elementId },
      data: {
        uuid: uuid(),
        sequence: nextSeq(cardId),
      },
    });
    return true;
  } catch (err) {
    console.error(`[Bot/Feishu] 删除组件失败 (${elementId}):`, err.message);
    return false;
  }
}

/**
 * 全量更新卡片
 */
export async function updateCardEntity(cardId, cardJson) {
  if (!client || !cardId) return false;
  try {
    await client.cardkit.v1.card.update({
      path: { card_id: cardId },
      data: {
        uuid: uuid(),
        sequence: nextSeq(cardId),
        card: { type: 'card_json', data: JSON.stringify(cardJson) },
      },
    });
    return true;
  } catch (err) {
    console.error('[Bot/Feishu] 全量更新卡片失败:', err.message);
    return false;
  }
}

/**
 * 更新卡片配置（如开/关 streaming_mode）
 * @param {string} cardId
 * @param {object} settings - 形如 { config: { streaming_mode: false } }
 */
export async function updateCardSettings(cardId, settings) {
  if (!client || !cardId) return false;
  try {
    await client.cardkit.v1.card.settings({
      path: { card_id: cardId },
      data: {
        uuid: uuid(),
        sequence: nextSeq(cardId),
        settings: JSON.stringify(settings),
      },
    });
    return true;
  } catch (err) {
    console.error('[Bot/Feishu] 更新卡片配置失败:', err.message);
    return false;
  }
}

/**
 * 关闭流式模式（卡片可转发、可交互、摘要从"生成中..."切回）
 */
export async function closeStreamingMode(cardId) {
  return updateCardSettings(cardId, { config: { streaming_mode: false } });
}

// ============================================================
//  数据库辅助
// ============================================================

/**
 * 根据 username 列表查询 feishu_open_id，用于私聊通知
 */
import db from '../db/init.js';

export function getFeishuOpenIds(usernames) {
  if (!usernames.length) return [];
  const placeholders = usernames.map(() => '?').join(',');
  return db.prepare(
    `SELECT username, feishu_open_id FROM users WHERE username IN (${placeholders}) AND feishu_open_id != ''`
  ).all(...usernames).map(r => ({ username: r.username, openId: r.feishu_open_id }));
}
