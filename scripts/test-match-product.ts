import assert from 'node:assert/strict';
import { matchProduct } from '../server/utils/wechat-parser.js';

const products = [
  {
    id: 'prod_tofu',
    name: '豆腐',
    specs: [{ id: 'spec_tofu', label: '常规', unitPrice: 2 }],
  },
  {
    id: 'prod_black_tofu',
    name: '黑豆腐',
    specs: [{ id: 'spec_black_tofu', label: '常规', unitPrice: 4 }],
  },
];

const result = matchProduct('黑豆腐', products);

assert.ok(result, '黑豆腐应该能匹配到商品');
assert.equal(result.productId, 'prod_black_tofu', '黑豆腐不该被匹配成普通豆腐');

console.log('matchProduct regression test passed');
