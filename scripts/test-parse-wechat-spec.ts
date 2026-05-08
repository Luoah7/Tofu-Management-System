import assert from 'node:assert/strict';
import { matchProductWithModel } from '../server/utils/product-matcher.js';

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

const result = await matchProductWithModel('未调味豆干', products);
const premiumTofu = await matchProductWithModel('精品豆腐', products);
const defaultTofu = await matchProductWithModel('豆腐', products);

assert.ok(result, '未调味豆干应该匹配成功');
assert.equal(result.productId, 'prod_dry_tofu', '商品应该还是豆干');
assert.equal(result.specId, 'spec_plain_dry_5', '规格应该选未调味');
assert.equal(result.unitPrice, 5, '价格应该是未调味规格的价格');
assert.ok(premiumTofu, '精品豆腐应该匹配成功');
assert.equal(premiumTofu.specId, 'spec_tofu_25', '精品豆腐应该选精品规格');
assert.ok(defaultTofu, '普通豆腐应该匹配成功');
assert.equal(defaultTofu.specId, 'spec_tofu_2', '普通豆腐应该选默认规格');

console.log('parse wechat spec regression test passed');
