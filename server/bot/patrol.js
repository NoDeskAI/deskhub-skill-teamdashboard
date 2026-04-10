/**
 * 定时巡检
 * 每天在配置时间扫描平台状态，发现异常则通知
 */

import { runPatrol } from './notify-llm.js';
import { sendCard, getFeishuOpenIds } from './feishu.js';
import { buildPatrolCard, buildPersonalNotificationCard } from './card-templates.js';

const PATROL_HOUR = Number(process.env.BOT_PATROL_HOUR) || 9;

let checkTimer = null;
let lastPatrolDate = '';

/**
 * 启动巡检定时器
 */
export function startPatrol() {
  // 每分钟检查是否到巡检时间
  checkTimer = setInterval(checkPatrolTime, 60_000);
  checkTimer.unref?.();
  console.log(`[Patrol] 巡检定时器已启动（每天 ${PATROL_HOUR}:00）`);
}

export function stopPatrol() {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}

async function checkPatrolTime() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  if (now.getHours() !== PATROL_HOUR) return;
  if (lastPatrolDate === today) return;
  lastPatrolDate = today;

  console.log('[Patrol] 开始每日巡检...');

  try {
    const decision = await runPatrol();

    // 群聊通知
    if (decision.group?.send && decision.group.message) {
      const card = buildPatrolCard(decision.group.message);
      await sendToGroups(card);
    }

    // 个性化私聊
    if (decision.individuals?.length > 0) {
      const usernames = decision.individuals.map(i => i.username);
      const mappings = getFeishuOpenIds(usernames);
      const openIdMap = Object.fromEntries(mappings.map(m => [m.username, m.openId]));

      for (const { username, message } of decision.individuals) {
        const openId = openIdMap[username];
        if (!openId) continue;
        const card = buildPersonalNotificationCard(message);
        await sendCard(openId, 'open_id', card);
      }
    }

    console.log(`[Patrol] 巡检完成: group=${decision.group?.send}, individuals=${decision.individuals?.length || 0}`);
  } catch (err) {
    console.error('[Patrol] 巡检失败:', err.message);
  }
}

async function sendToGroups(card) {
  const chatIds = (process.env.FEISHU_NOTIFY_CHAT_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  for (const chatId of chatIds) {
    await sendCard(chatId, 'chat_id', card);
  }
}
