/**
 * 一次性工具：预览调整后的思考胶囊（无边框 grey-50 底 + 黑字）
 * 用法：node bot/_preview-pill.js <ou_xxx>
 */

import '../env.js';
import * as lark from '@larksuiteoapi/node-sdk';
import { buildThinkingPill } from './card-templates.js';

function buildCard() {
  return {
    schema: '2.0',
    config: { update_multi: true, width_mode: 'fill' },
    header: {
      title: { tag: 'plain_text', content: '思考胶囊 · 新版（无边框灰底）' },
      subtitle: { tag: 'plain_text', content: 'background_color=grey-50 · 黑字' },
      icon: { tag: 'standard_icon', token: 'search_outlined', color: 'turquoise' },
      template: 'default',
    },
    body: {
      elements: [
        { tag: 'markdown', content: '（这是一段正文开头）这就来帮你查一下 P-012 的情况...' },
        ...buildThinkingPill(0).map(el => ({
          ...el,
          elements: el.elements.map(inner => ({
            ...inner,
            content: '先看用户问的是 P-012 还是 M-003，再去调 get_plan_detail...',
          })),
        })),
        { tag: 'markdown', content: '（正文继续）...' },
      ],
    },
  };
}

async function main() {
  const openId = process.argv[2];
  if (!openId?.startsWith('ou_')) { console.error('用法：node bot/_preview-pill.js <ou_xxx>'); process.exit(1); }
  const client = new lark.Client({
    appId: process.env.FEISHU_APP_ID, appSecret: process.env.FEISHU_APP_SECRET,
    appType: lark.AppType.SelfBuild, domain: lark.Domain.Feishu,
  });
  const createRes = await client.cardkit.v1.card.create({
    data: { type: 'card_json', data: JSON.stringify(buildCard()) },
  });
  if (createRes.code !== 0) { console.error('❌', createRes.msg); process.exit(1); }
  const cardId = createRes.data?.card_id;
  const sendRes = await client.im.v1.message.create({
    params: { receive_id_type: 'open_id' },
    data: { receive_id: openId, msg_type: 'interactive',
            content: JSON.stringify({ type: 'card', data: { card_id: cardId } }) },
  });
  console.log(sendRes.code === 0 ? `✓ 新版胶囊已发 ${cardId}` : `❌ ${sendRes.msg}`);
  process.exit(0);
}
main().catch(e => { console.error('💥', e.message); process.exit(1); });
