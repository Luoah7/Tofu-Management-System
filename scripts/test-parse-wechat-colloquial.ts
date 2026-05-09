import assert from 'node:assert/strict';
import { parseWeChatText } from '../server/utils/wechat-parser.js';

const oneBasketOrder = parseWeChatText('东桥 明天早上一盘');

assert.equal(oneBasketOrder.length, 1, '一盘口语单应该解析成 1 个商户');
assert.equal(oneBasketOrder[0]?.merchantName, '东桥', '应该识别出商户名');
assert.deepEqual(oneBasketOrder[0]?.items, [
  { name: '豆腐', amount: 1, unit: '筐', weight: 12 },
], '一盘应该按一筐豆腐 12 斤处理');
assert.deepEqual(oneBasketOrder[0]?.warnings || [], [], '明确的一盘订单不该产生告警');

const mixedOrder = parseWeChatText('刘记 明天送豆腐，黑豆腐少送，豆干3斤');

assert.equal(mixedOrder.length, 1, '口语混合单应该解析成 1 个商户');
assert.equal(mixedOrder[0]?.merchantName, '刘记', '应该识别出商户名');
assert.deepEqual(mixedOrder[0]?.items, [
  { name: '豆腐', amount: 1, unit: '筐', weight: 12 },
  { name: '豆干', amount: 3, unit: '斤', weight: 3 },
], '默认豆腐和明确斤数商品都该被识别');
assert.deepEqual(mixedOrder[0]?.warnings, [
  '黑豆腐少送，数量不明确，需人工确认',
], '少送这类口语要保留人工确认提示');

const stickyOrder = parseWeChatText('东桥超市：精品豆腐一筐，未调味豆干三斤');

assert.equal(stickyOrder.length, 1, '中文数量和黏连商品应该能识别');
assert.deepEqual(stickyOrder[0]?.items, [
  { name: '精品豆腐', amount: 1, unit: '筐', weight: 12 },
  { name: '未调味豆干', amount: 3, unit: '斤', weight: 3 },
], '中文数字应该转成标准数量');

const spaceOrder = parseWeChatText('老王 豆腐2筐 豆干5斤');

assert.equal(spaceOrder.length, 1, '空格分隔的多个商品应该能识别');
assert.deepEqual(spaceOrder[0]?.items, [
  { name: '豆腐', amount: 2, unit: '筐', weight: 24 },
  { name: '豆干', amount: 5, unit: '斤', weight: 5 },
], '空格分隔商品应该拆成多个品项');

const unclearOrder = parseWeChatText('散户：黑豆腐少送，豆干少来点，豆腐照旧');

assert.equal(unclearOrder.length, 1, '数量不明文本也应该保留商户和风险提示');
assert.deepEqual(unclearOrder[0]?.items, [], '数量不明时不能编商品数量');
assert.deepEqual(unclearOrder[0]?.warnings, [
  '黑豆腐少送，数量不明确，需人工确认',
  '豆干少来点，数量不明确，需人工确认',
  '豆腐照旧，数量不明确，需人工确认',
], '数量不明文本应该进入人工确认提示');

console.log('parse colloquial wechat order regression test passed');
