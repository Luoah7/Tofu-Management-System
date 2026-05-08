import assert from 'node:assert/strict';
import { matchProduct } from '../server/utils/wechat-parser.js';

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

const result = matchProduct('未调味豆干', products);
const premiumTofu = matchProduct('精品豆腐', products);
const defaultTofu = matchProduct('豆腐', products);

assert.ok(result, '未调味豆干应该能匹配到商品');
assert.equal(result.specId, 'spec_plain_dry_5', '未调味豆干不该落到调味规格');
assert.ok(premiumTofu, '精品豆腐应该能匹配到商品');
assert.equal(premiumTofu.specId, 'spec_tofu_25', '精品豆腐应该落到精品规格');
assert.ok(defaultTofu, '普通豆腐应该能匹配到商品');
assert.equal(defaultTofu.specId, 'spec_tofu_2', '没写规格时应该落到默认规格');

console.log('matchProduct spec regression test passed');
