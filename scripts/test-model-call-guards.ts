import assert from 'node:assert/strict';
import { parseOrderText } from '../server/utils/order-parser.js';
import { matchProductWithModel } from '../server/utils/product-matcher.js';

process.env.DEEPSEEK_API_KEY = 'test-key';
process.env.DEEPSEEK_BASE_URL = 'https://example.invalid';
process.env.DEEPSEEK_MODEL = 'test-model';

let fetchCalls = 0;
const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async () => {
  fetchCalls += 1;
  throw new Error('model should not be called for locally matched input');
};

const products = [
  {
    id: 'prod_tofu',
    name: '豆腐',
    specs: [
      { id: 'spec_tofu_2', label: '常规价 ¥2/斤', unitPrice: 2 },
      { id: 'spec_tofu_25', label: '精品价 ¥2.5/斤', unitPrice: 2.5 },
    ],
  },
  {
    id: 'prod_dry_tofu',
    name: '豆干',
    specs: [
      { id: 'spec_seasoned_dry_6', label: '调味 ¥6/斤', unitPrice: 6 },
      { id: 'spec_plain_dry_5', label: '未调味 ¥5/斤', unitPrice: 5 },
    ],
  },
];

const parsed = await parseOrderText('东桥超市：豆腐2筐，未调味豆干3斤');
const matched = await matchProductWithModel('未调味豆干', products);

globalThis.fetch = originalFetch;

assert.equal(fetchCalls, 0, '本地规则能识别时不应该调用大模型');
assert.equal(parsed.length, 1, '本地订单解析应该成功');
assert.equal(parsed[0].items.length, 2, '本地订单品项应该解析完整');
assert.ok(matched, '本地规格匹配应该成功');
assert.equal(matched.specId, 'spec_plain_dry_5', '未调味豆干应该选未调味规格');

console.log('model call guard regression test passed');
