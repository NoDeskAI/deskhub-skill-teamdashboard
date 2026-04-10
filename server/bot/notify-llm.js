/**
 * 小合通知/巡检/中继代理
 * 轻量版 LLM tool-use 循环，独立于 chat() 的聊天逻辑
 *
 * 三个入口：
 *   analyzeChanges(changes)      — 变更通知决策
 *   runPatrol()                   — 定时巡检
 *   handleXiaoheTask(msg, caller) — MCP / 用户中继
 */

import { TOOL_DEFINITIONS, executeTool } from './tools.js';

const API_URL = 'https://api.minimaxi.com/anthropic/v1/messages';
const MAX_TOOL_ROUNDS = 4;
const REQUEST_TIMEOUT = 30000;
const MAX_TOKENS = 4096;

// ============================================================
//  System Prompts（按模式切换）
// ============================================================

function buildNotifyPrompt(changes) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const nowMs = now.getTime();

  const changeList = changes.map(c =>
    `- [${c.priority}] ${c.action} | ${c.entityType}:${c.entityId} | ${c.summary} | actor: ${c.actor || '未知'}`
  ).join('\n');

  return {
    system: `你是小合，DeskSkill TeamBoard 的协作中枢。现在你收到一批工作台变更，需要决定通知策略。

当前时间：${today}（毫秒时间戳 ${nowMs}）。

## 通知原则
1. **永远不通知操作者本人**（actor 做的事不需要再告诉 actor）
2. 工单 owner 应该知道其工单的重要变更（新方案、评分、状态变化）
3. 方案 uploader 应该知道其方案的评分变化和工单定稿结果
4. 已评分 tester 应该知道工单的定稿结果
5. 低优先级的小编辑（改描述、备注）可以不通知
6. 同批多条关联变更合并成一条通知
7. 只能通知 users 表中的团队成员

## 你的工具
用 list_users 查所有团队成员。用 get_plan_detail 查工单详情（看 owner、uploader、tester）。
查完之后再做通知决策——不要猜，用工具确认。

## 消息风格
简短友好，1-3 句话。告诉对方「发生了什么」+「你可能需要做什么」。
好：「你负责的「PPT优化」有新方案提交了，目前共 3 个方案，可以安排评测了。」
好：「你提交的方案「NotebookLM」收到了新评分，均分 8.3，排名第一。」
坏：「系统通知：variant created on plan p5678。」

可以用 send_notification 工具直接发送私聊通知。

## 输出格式
最终用纯 JSON 输出（不要 markdown 包裹）：
{
  "group": { "send": true/false, "message": "群聊通知内容（markdown格式）" },
  "individuals": [{ "username": "xxx", "message": "私聊内容" }],
  "reasoning": "决策理由（调试用）"
}

如果这批变更不值得通知任何人：
{ "group": { "send": false }, "individuals": [], "reasoning": "..." }`,

    user: `以下是待处理的变更批次：\n\n${changeList}\n\n请分析这些变更，决定通知策略。先用工具查询相关工单详情和团队成员，再做决策。`,
  };
}

function buildPatrolPrompt() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const nowMs = now.getTime();

  return {
    system: `你是小合，DeskSkill TeamBoard 的协作中枢。现在是每日巡检时间，你需要扫描平台状态，发现异常。

当前时间：${today}（毫秒时间戳 ${nowMs}）。

## 巡检要点
用工具查询所有工单和团队成员，检查以下异常：
- 高优先级工单待开始超过 5 天
- 截止日期临近（≤3天）但进度不足
- 评分全到齐，可以定稿（提醒管理员）
- 活跃工单只有 1 个方案（征集不够）
- 某方案提交超过 5 天没有评分
- 测试员负载不均（有人评了很多，有人没评）

## 输出格式
纯 JSON：
{
  "group": { "send": true/false, "message": "巡检摘要（markdown格式）" },
  "individuals": [{ "username": "xxx", "message": "针对此人的提醒" }],
  "reasoning": "巡检发现"
}

一切正常 → { "group": { "send": false }, "individuals": [], "reasoning": "无异常" }
只有值得关注的异常才通知。不要把正常状态当异常。`,

    user: '请执行每日巡检。先用工具查询所有工单状态和团队成员，然后分析是否有需要关注的异常。',
  };
}

function buildRelayPrompt(callerUsername) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const nowMs = now.getTime();

  return `你是小合，DeskSkill TeamBoard 的协作中枢。

当前时间：${today}（毫秒时间戳 ${nowMs}）。
调用者：${callerUsername}

你收到了一个任务请求。理解意图后执行：
- 如果是通知某人 → 用工具查上下文，然后用 send_notification 发送个性化消息
- 如果是查询数据 → 用工具查询并返回结果
- 只能通知 users 表中的团队成员
- 不修改平台数据

消息风格：简短友好，带上下文。不是原封转发，而是理解后组织。
比如调用者说"通知测试员开始评测"，你应该先查有哪些待评测的工单，再给测试员发具体内容。

直接回复执行结果。`;
}

// ============================================================
//  轻量版 tool-use 循环
// ============================================================

async function runAgent(systemPrompt, userMessage) {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY 未配置');

  const model = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';
  const messages = [{ role: 'user', content: userMessage }];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_TOKENS,
          system: systemPrompt,
          tools: TOOL_DEFINITIONS,
          messages,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`MiniMax API ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    messages.push({ role: 'assistant', content: data.content });

    const hasToolUse = data.content?.some(b => b.type === 'tool_use');

    // 不需要工具或到达终止
    if (data.stop_reason === 'end_turn' || data.stop_reason === 'max_tokens' || !hasToolUse) {
      const textBlocks = data.content?.filter(b => b.type === 'text') || [];
      return textBlocks.map(b => b.text).join('\n');
    }

    // 执行工具
    const toolUseBlocks = data.content.filter(b => b.type === 'tool_use');
    const toolResults = [];

    for (const block of toolUseBlocks) {
      let result;
      let isError = false;
      try {
        const output = await executeTool(block.name, block.input);
        result = JSON.stringify(output, null, 2);
      } catch (err) {
        result = `工具执行失败: ${err.message}`;
        isError = true;
      }

      const toolResult = {
        type: 'tool_result',
        tool_use_id: block.id,
        content: result,
      };
      if (isError) toolResult.is_error = true;
      toolResults.push(toolResult);
    }

    messages.push({ role: 'user', content: toolResults });
  }

  return '{"group":{"send":false},"individuals":[],"reasoning":"工具调用轮次过多"}';
}

// ============================================================
//  解析 LLM JSON 输出
// ============================================================

function parseDecision(text) {
  // 尝试从文本中提取 JSON
  let json = text.trim();

  // 去掉可能的 markdown 代码块包裹
  const codeBlockMatch = json.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) json = codeBlockMatch[1].trim();

  try {
    const decision = JSON.parse(json);
    // 基本结构校验
    if (!decision.group) decision.group = { send: false };
    if (!Array.isArray(decision.individuals)) decision.individuals = [];
    return decision;
  } catch {
    console.error('[NotifyLLM] JSON 解析失败:', text.slice(0, 200));
    return null;
  }
}

// ============================================================
//  对外暴露的三个入口
// ============================================================

/**
 * 分析一批变更，返回通知决策
 */
export async function analyzeChanges(changes) {
  const { system, user } = buildNotifyPrompt(changes);
  const raw = await runAgent(system, user);
  const decision = parseDecision(raw);

  if (decision) {
    console.log(`[NotifyLLM] 通知决策: group=${decision.group?.send}, individuals=${decision.individuals?.length}, reasoning=${decision.reasoning?.slice(0, 80)}`);
    return decision;
  }

  // 解析失败退化为兜底
  return fallbackNotify(changes);
}

/**
 * 定时巡检
 */
export async function runPatrol() {
  const { system, user } = buildPatrolPrompt();
  const raw = await runAgent(system, user);
  const decision = parseDecision(raw);

  if (decision) {
    console.log(`[NotifyLLM] 巡检结果: group=${decision.group?.send}, individuals=${decision.individuals?.length}`);
    return decision;
  }

  return { group: { send: false }, individuals: [], reasoning: '巡检 LLM 解析失败' };
}

/**
 * MCP / 用户中继任务
 */
export async function handleXiaoheTask(message, callerUsername) {
  const system = buildRelayPrompt(callerUsername);
  const result = await runAgent(system, message);
  return result || '任务处理完成。';
}

/**
 * LLM 失败时的兜底通知
 */
export function fallbackNotify(changes) {
  const lines = changes.map(c => {
    const emoji = { created: '🆕', updated: '📝', status_changed: '🔄', deleted: '🗑️' }[c.action] || '📌';
    return `${emoji} ${c.summary}`;
  });

  return {
    group: { send: true, message: lines.join('\n') },
    individuals: [],
    reasoning: 'LLM 不可用，兜底模板',
  };
}
