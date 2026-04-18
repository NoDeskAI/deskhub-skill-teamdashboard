/**
 * MarkupStream 单元测试 — 纯 node 跑，不发卡片
 *
 * 用法：cd server && node bot/_probe-parser.js
 *
 * 覆盖：跨 chunk 切 markup / 多 markup 一 chunk / 无效 tag / 未闭合超时兜底 / flush 尾 buffer
 */

import { MarkupStream } from './markup-parser.js';

let passCount = 0;
let failCount = 0;

function assertEq(label, got, expected) {
  const gotStr = JSON.stringify(got);
  const expectedStr = JSON.stringify(expected);
  if (gotStr === expectedStr) {
    console.log(`  ✓ ${label}`);
    passCount++;
  } else {
    console.log(`  ✗ ${label}`);
    console.log(`    expected: ${expectedStr}`);
    console.log(`    got:      ${gotStr}`);
    failCount++;
  }
}

// ── 场景 1：单 chunk 内一个完整 markup ──
{
  console.log('\n[case 1] 单 chunk 完整 markup');
  const s = new MarkupStream();
  const parts = s.feed('hello [[plan:P-012]] world');
  assertEq('len=3', parts.length, 3);
  assertEq('[0] text=hello ', parts[0], { kind: 'text', text: 'hello ' });
  assertEq('[1] markup plan', parts[1], { kind: 'markup', tag: 'plan', args: ['P-012'], placement: 'block' });
  assertEq('[2] text= world', parts[2], { kind: 'text', text: ' world' });
}

// ── 场景 2：跨 chunk 切开 `[[` 和 `]]` ──
{
  console.log('\n[case 2] 跨 chunk 切 markup');
  const s = new MarkupStream();
  const p1 = s.feed('before [[pla');
  const p2 = s.feed('n:P-012]] after');
  assertEq('p1: [0] text before', p1, [{ kind: 'text', text: 'before ' }]);
  assertEq('p2: markup + text', p2, [
    { kind: 'markup', tag: 'plan', args: ['P-012'], placement: 'block' },
    { kind: 'text', text: ' after' },
  ]);
}

// ── 场景 3：多个 markup 一次 chunk 内 ──
{
  console.log('\n[case 3] 一 chunk 多 markup');
  const s = new MarkupStream();
  const parts = s.feed('[[plan:P-001]][[plan:P-002]][[user:liwei]]');
  assertEq('len=3', parts.length, 3);
  assertEq('[0] plan P-001', parts[0], { kind: 'markup', tag: 'plan', args: ['P-001'], placement: 'block' });
  assertEq('[1] plan P-002', parts[1], { kind: 'markup', tag: 'plan', args: ['P-002'], placement: 'block' });
  assertEq('[2] user inline', parts[2], { kind: 'markup', tag: 'user', args: ['liwei'], placement: 'inline' });
}

// ── 场景 4：带多参数（callout） ──
{
  console.log('\n[case 4] 多参数 callout');
  const s = new MarkupStream();
  const parts = s.feed('[[callout:info|本周所有工单已定稿]]');
  assertEq('callout with 2 args', parts, [
    { kind: 'markup', tag: 'callout', args: ['info', '本周所有工单已定稿'], placement: 'block' },
  ]);
}

// ── 场景 5：无参 divider ──
{
  console.log('\n[case 5] 无参 divider');
  const s = new MarkupStream();
  const parts = s.feed('段落一\n[[divider]]\n段落二');
  assertEq('divider + 前后 text', parts, [
    { kind: 'text', text: '段落一\n' },
    { kind: 'markup', tag: 'divider', args: [], placement: 'block' },
    { kind: 'text', text: '\n段落二' },
  ]);
}

// ── 场景 6：无效 tag 当普通文本 ──
{
  console.log('\n[case 6] 无效 tag 保留原文');
  const s = new MarkupStream();
  const parts = s.feed('a [[unknown:xxx]] b');
  assertEq('保留 [[unknown:xxx]] 原文', parts, [
    { kind: 'text', text: 'a ' },
    { kind: 'text', text: '[[unknown:xxx]]' },
    { kind: 'text', text: ' b' },
  ]);
}

// ── 场景 7：未闭合超过 MAX_PENDING 兜底 ──
{
  console.log('\n[case 7] 未闭合超时兜底');
  const s = new MarkupStream();
  const bigOpen = '[[plan:' + 'x'.repeat(250);
  const parts = s.feed(bigOpen);
  assertEq('整体当 text 泄出', parts.length, 1);
  assertEq('[0] kind=text', parts[0].kind, 'text');
  assertEq('[0] 长度匹配', parts[0].text.length, bigOpen.length);
}

// ── 场景 8：flush 尾 buffer（流结束时还有未闭合 `[[`） ──
{
  console.log('\n[case 8] flush 尾 buffer');
  const s = new MarkupStream();
  s.feed('hello [[pla');
  const tail = s.flush();
  assertEq('flush 返回未完成 text', tail, [{ kind: 'text', text: '[[pla' }]);
}

// ── 场景 9：link 内联 ──
{
  console.log('\n[case 9] link 内联');
  const s = new MarkupStream();
  const parts = s.feed('看 [[link:https://example.com|这里]] 详情');
  assertEq('link inline', parts, [
    { kind: 'text', text: '看 ' },
    { kind: 'markup', tag: 'link', args: ['https://example.com', '这里'], placement: 'inline' },
    { kind: 'text', text: ' 详情' },
  ]);
}

// ── 场景 10：header markup（Stage C 才消费，Stage B 只识别） ──
{
  console.log('\n[case 10] header 识别');
  const s = new MarkupStream();
  const parts = s.feed('[[header:小合 · 工单房|翻抽屉中|violet]]\n正文');
  assertEq('header block', parts[0], {
    kind: 'markup', tag: 'header',
    args: ['小合 · 工单房', '翻抽屉中', 'violet'],
    placement: 'block',
  });
  assertEq('\\n正文 text', parts[1], { kind: 'text', text: '\n正文' });
}

// ── 场景 11：一个字符一个字符喂（极端切法） ──
{
  console.log('\n[case 11] 一字一喂');
  const s = new MarkupStream();
  const input = 'ab[[plan:X]]cd';
  const collected = [];
  for (const ch of input) {
    for (const p of s.feed(ch)) collected.push(p);
  }
  for (const p of s.flush()) collected.push(p);
  // 会出现 text 碎片 — 合并后看最终语义
  const joined = collected.reduce((acc, p) => {
    if (p.kind === 'text') {
      if (acc.length && acc[acc.length - 1].kind === 'text') {
        acc[acc.length - 1].text += p.text;
      } else acc.push({ ...p });
    } else acc.push(p);
    return acc;
  }, []);
  assertEq('合并后 3 部分', joined, [
    { kind: 'text', text: 'ab' },
    { kind: 'markup', tag: 'plan', args: ['X'], placement: 'block' },
    { kind: 'text', text: 'cd' },
  ]);
}

// ── 汇总 ──
console.log(`\n总结: ${passCount} passed, ${failCount} failed`);
process.exit(failCount > 0 ? 1 : 0);
