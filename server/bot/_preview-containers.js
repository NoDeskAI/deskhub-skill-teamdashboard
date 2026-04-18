/**
 * 一次性工具：发两张示例卡预览 interactive_container 的局部色块效果
 * 用法：node bot/_preview-containers.js <ou_xxx>
 */

import '../env.js';
import * as lark from '@larksuiteoapi/node-sdk';

function buildCalloutCard() {
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: {
      title: { tag: 'plain_text', content: '局部色块 · 四级 Callout' },
      subtitle: { tag: 'plain_text', content: 'interactive_container + background_style' },
      icon: { tag: 'standard_icon', token: 'info_outlined', color: 'indigo' },
      template: 'default',
    },
    body: {
      elements: [
        { tag: 'markdown', content: '下面四种色块，用 `interactive_container` 套 markdown 渲染，背景色走 `background_style` 枚举：' },
        {
          tag: 'interactive_container',
          padding: '10px 14px',
          margin: '8px 0',
          corner_radius: '8px',
          background_style: 'blue-50',
          elements: [
            { tag: 'markdown', content: "<text_tag color='blue'>提示</text_tag> 本周共有 3 个工单定稿，P-012 得分最高。" },
          ],
        },
        {
          tag: 'interactive_container',
          padding: '10px 14px',
          margin: '8px 0',
          corner_radius: '8px',
          background_style: 'green-50',
          elements: [
            { tag: 'markdown', content: "<text_tag color='green'>成功</text_tag> 评测已完成，所有方案均已打分。" },
          ],
        },
        {
          tag: 'interactive_container',
          padding: '10px 14px',
          margin: '8px 0',
          corner_radius: '8px',
          background_style: 'orange-50',
          elements: [
            { tag: 'markdown', content: "<text_tag color='orange'>注意</text_tag> 还有 2 个工单距离截止日期不到 48 小时。" },
          ],
        },
        {
          tag: 'interactive_container',
          padding: '10px 14px',
          margin: '8px 0',
          corner_radius: '8px',
          background_style: 'red-50',
          elements: [
            { tag: 'markdown', content: "<text_tag color='red'>错误</text_tag> 方案 B 评分不完整，缺少 2 个维度的评分。" },
          ],
        },
      ],
    },
  };
}

function buildPlanCardEmbedCard() {
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: {
      title: { tag: 'plain_text', content: '局部色块 · 工单嵌入小卡' },
      subtitle: { tag: 'plain_text', content: 'interactive_container + has_border + corner_radius' },
      icon: { tag: 'standard_icon', token: 'edit_outlined', color: 'violet' },
      template: 'default',
    },
    body: {
      elements: [
        { tag: 'markdown', content: 'P-012 的当前状态：' },
        {
          tag: 'interactive_container',
          padding: '12px 14px',
          margin: '8px 0',
          has_border: true,
          border_color: 'grey',
          corner_radius: '10px',
          background_style: 'default',
          elements: [
            {
              tag: 'markdown',
              content: "**P-012 · 技能评测流程优化** <text_tag color='red'>高优</text_tag> <text_tag color='orange'>评测中</text_tag>\n\n<font color='grey'>方案 3 个 · 均分 8.2 · 负责人 liwei</font>",
            },
          ],
        },
        { tag: 'markdown', content: '建议尽快定稿，评测覆盖率已达 80%。' },
        { tag: 'hr' },
        { tag: 'markdown', content: "<font color='grey'>下面再来个无边框、灰底的变体对比：</font>" },
        {
          tag: 'interactive_container',
          padding: '12px 14px',
          margin: '8px 0',
          has_border: false,
          corner_radius: '10px',
          background_style: 'grey-50',
          elements: [
            {
              tag: 'markdown',
              content: "**P-013 · MCP 注册面板** <text_tag color='orange'>中优</text_tag> <text_tag color='blue'>征集中</text_tag>\n\n<font color='grey'>方案 1 个 · 负责人 wangang</font>",
            },
          ],
        },
      ],
    },
  };
}

async function main() {
  const openId = process.argv[2];
  if (!openId || !openId.startsWith('ou_')) {
    console.error('用法：node bot/_preview-containers.js <ou_xxx>');
    process.exit(1);
  }
  const client = new lark.Client({
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
  });
  async function send(card, label) {
    const createRes = await client.cardkit.v1.card.create({
      data: { type: 'card_json', data: JSON.stringify(card) },
    });
    if (createRes.code !== 0) { console.error(`❌ ${label}: ${createRes.msg}`); return; }
    const cardId = createRes.data?.card_id;
    const sendRes = await client.im.v1.message.create({
      params: { receive_id_type: 'open_id' },
      data: {
        receive_id: openId,
        msg_type: 'interactive',
        content: JSON.stringify({ type: 'card', data: { card_id: cardId } }),
      },
    });
    if (sendRes.code !== 0) console.error(`❌ ${label} send: ${sendRes.msg}`);
    else console.log(`✓ ${label}`);
  }
  await send(buildCalloutCard(), 'Callout 四级色块');
  await send(buildPlanCardEmbedCard(), '工单小卡（两种风格）');
  console.log('\n✅ 2 张发送完毕');
  process.exit(0);
}

main().catch(err => { console.error('💥', err.message); process.exit(1); });
