/**
 * MCP tell_xiaohe 工具
 * 统一入口：所有 MCP 请求通过小合的 LLM 判断后执行
 */

import { z } from 'zod';
import { handleXiaoheTask } from '../../bot/notify-llm.js';

export function registerNotifyTools(server, auth) {
  server.tool(
    'tell_xiaohe',
    '给小合（飞书助手）下达任务。可以让她通知团队成员、分析数据、传达消息等。所有请求经过小合的判断后执行。例如："通知测试员开始评测 PPT 工单"、"帮我告诉小明他的方案评分出来了"。',
    {
      message: z.string().describe('要传达给小合的内容，自然语言即可'),
    },
    async ({ message }) => {
      try {
        const result = await handleXiaoheTask(message, auth.username);
        return {
          content: [{ type: 'text', text: result }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `小合处理任务时出错: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}
