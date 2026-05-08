import assert from 'node:assert/strict';
import { parseWeChatText } from '../server/utils/wechat-parser.js';

const colloquial = parseWeChatText('东桥 明天早上一盘');
assert.equal(colloquial.length, 1, '一盘口语应该能识别');
assert.deepEqual(
  colloquial[0].items[0],
  { name: '豆腐', amount: 1, unit: '筐', weight: 12 },
  '一盘应该落成1筐豆腐，并保留12斤估重',
);

const kilogram = parseWeChatText('刘记：豆干3公斤');
assert.equal(kilogram.length, 1, '公斤口语应该能识别');
assert.deepEqual(
  kilogram[0].items[0],
  { name: '豆干', amount: 3, unit: '公斤', weight: 6 },
  '3公斤应该换算成6斤',
);

const baskets = parseWeChatText('东桥超市：豆腐2筐，黑豆腐1筐');
assert.deepEqual(
  baskets[0].items,
  [
    { name: '豆腐', amount: 2, unit: '筐', weight: 24 },
    { name: '黑豆腐', amount: 1, unit: '筐', weight: 12 },
  ],
  '批量导入里的筐数应该保留下来',
);

console.log('parse order unit regression test passed');
