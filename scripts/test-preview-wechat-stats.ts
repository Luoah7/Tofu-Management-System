import assert from 'node:assert/strict';
import { buildWechatPreview } from '../server/routes/tasks.js';

const merchants = [
  {
    id: 'merchant_dongqiao',
    name: '东桥超市',
    type: '超市',
    phone: '13800000000',
    address: '东桥路',
    settlementDay: '月结',
  },
  {
    id: 'merchant_sanhu',
    name: '散户',
    type: '散户',
    phone: '',
    address: '',
    settlementDay: '日结',
  },
];

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

const preview = await buildWechatPreview({
  text: [
    '东桥：精品豆腐一筐，未调味豆干三斤',
    '散户：豆干少来点',
    '陌生商户：豆腐2筐',
  ].join('\n'),
  taskDate: '2026-05-10',
  merchants,
  products,
});

assert.equal(preview.tasks.length, 1, '只有可导入商户和可识别商品应该进入任务预览');
assert.equal(preview.tasks[0].merchantName, '东桥超市', '商户应该支持模糊匹配');
assert.deepEqual(
  preview.tasks[0].items.map(item => ({
    productName: item.productName,
    specId: item.specId,
    displayAmount: item.displayAmount,
    displayUnit: item.displayUnit,
    source: item.source,
  })),
  [
    {
      productName: '豆腐',
      specId: 'spec_tofu_25',
      displayAmount: 1,
      displayUnit: '筐',
      source: 'rule',
    },
    {
      productName: '豆干',
      specId: 'spec_plain_dry_5',
      displayAmount: 3,
      displayUnit: '斤',
      source: 'rule',
    },
  ],
  '预览品项应该带本地识别来源',
);
assert.deepEqual(preview.unrecognizedSegments, ['豆干少来点，数量不明确，需人工确认'], '数量不明应该进入未识别区域');
assert.deepEqual(preview.skippedMerchants, ['陌生商户'], '未匹配商户应该进入跳过列表');
assert.deepEqual(preview.stats, {
  totalLines: 3,
  ruleMatchedCount: 2,
  modelFallbackCount: 0,
  unrecognizedCount: 1,
  skippedMerchantCount: 1,
}, '预览统计应该反映识别来源和风险数量');

console.log('preview wechat stats regression test passed');
