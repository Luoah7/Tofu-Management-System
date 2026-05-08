import assert from 'node:assert/strict';
import { parseWeChatText } from '../server/utils/wechat-parser.js';

const oneBasketOrder = parseWeChatText('东桥 明天早上一盘');

assert.equal(oneBasketOrder.length, 1, '一盘口语单应该解析成 1 个商户');
assert.equal(oneBasketOrder[0]?.merchantName, '东桥', '应该识别出商户名');
assert.deepEqual(oneBasketOrder[0]?.items, [
  { name: '豆腐', weight: 12 },
], '一盘应该按一筐豆腐 12 斤处理');
assert.deepEqual(oneBasketOrder[0]?.warnings || [], [], '明确的一盘订单不该产生告警');

const mixedOrder = parseWeChatText('刘记 明天送豆腐，黑豆腐少送，豆干3斤');

assert.equal(mixedOrder.length, 1, '口语混合单应该解析成 1 个商户');
assert.equal(mixedOrder[0]?.merchantName, '刘记', '应该识别出商户名');
assert.deepEqual(mixedOrder[0]?.items, [
  { name: '豆腐', weight: 12 },
  { name: '豆干', weight: 3 },
], '默认豆腐和明确斤数商品都该被识别');
assert.deepEqual(mixedOrder[0]?.warnings, [
  '黑豆腐少送，数量不明确，需人工确认',
], '少送这类口语要保留人工确认提示');

console.log('parse colloquial wechat order regression test passed');
