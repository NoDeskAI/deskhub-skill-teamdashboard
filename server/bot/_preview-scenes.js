/**
 * 一次性工具：把修好 icon 后的 5 个场景 initial header + 1 个完成态 header
 * 直接发到指定私聊，肉眼确认 icon 都彩色渲染
 *
 * 用法：node bot/_preview-scenes.js <open_id>
 */

import '../env.js';
import * as lark from '@larksuiteoapi/node-sdk';
import { pickInitialHeader, pickCompletionHeader } from './card-templates.js';

const SCENES = [
  { key: 'default',   desc: '日常对话场景 · icon=chat_outlined · color=orange' },
  { key: 'data',      desc: '数据查询场景 · icon=bitablekanban_outlined · color=indigo' },
  { key: 'plan',      desc: '工单操作场景 · icon=edit_outlined · color=violet' },
  { key: 'deepthink', desc: '深度思考场景 · icon=search_outlined · color=turquoise' },
  { key: 'error',     desc: '错误场景 · icon=close_outlined · color=red · template=red' },
];

function buildPreview(scene) {
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: pickInitialHeader(scene.key),
    body: {
      elements: [
        { tag: 'markdown', content: `场景：**${scene.key}**\n\n${scene.desc}` },
      ],
    },
  };
}

function buildCompletionPreview() {
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: pickCompletionHeader('plan', 3400),
    body: {
      elements: [
        { tag: 'markdown', content: '**完成态 header**\n\nicon=done_outlined · color=green · 任意场景完成时切到这个' },
      ],
    },
  };
}

async function main() {
  const openId = process.argv[2];
  if (!openId || !openId.startsWith('ou_')) {
    console.error('用法：node bot/_preview-scenes.js <ou_xxx>');
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
    if (createRes.code !== 0) {
      console.error(`❌ ${label}: code=${createRes.code} msg=${createRes.msg}`);
      return;
    }
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

  for (const scene of SCENES) {
    await send(buildPreview(scene), `${scene.key} initial`);
  }
  await send(buildCompletionPreview(), 'complete');

  console.log('\n✅ 6 张卡已送达，打开飞书私聊看 icon 是否都彩色。');
  process.exit(0);
}

main().catch(err => { console.error('💥', err.message); process.exit(1); });
