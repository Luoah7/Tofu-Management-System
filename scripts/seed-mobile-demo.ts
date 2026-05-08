import Database from 'better-sqlite3';
import path from 'path';
import '../server/env.js';

const dbPath = process.env.DB_PATH || './data/doufu.db';
const sqlite = new Database(path.resolve(process.cwd(), dbPath));
sqlite.pragma('foreign_keys = ON');

const today = '2026-05-08';

const upsertTask = sqlite.prepare(`
  INSERT INTO delivery_tasks (
    id, task_date, merchant_id, merchant_name, merchant_type, address, phone,
    route_eta, status, settlement_day, planned_weight, actual_weight, photo_count,
    before_basket_count, sent_basket_count, returned_basket_count, sign_method,
    operator, completed_at, exception_reason, exception_note, note
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    task_date=excluded.task_date,
    merchant_id=excluded.merchant_id,
    merchant_name=excluded.merchant_name,
    merchant_type=excluded.merchant_type,
    address=excluded.address,
    phone=excluded.phone,
    route_eta=excluded.route_eta,
    status=excluded.status,
    settlement_day=excluded.settlement_day,
    planned_weight=excluded.planned_weight,
    actual_weight=excluded.actual_weight,
    photo_count=excluded.photo_count,
    before_basket_count=excluded.before_basket_count,
    sent_basket_count=excluded.sent_basket_count,
    returned_basket_count=excluded.returned_basket_count,
    sign_method=excluded.sign_method,
    operator=excluded.operator,
    completed_at=excluded.completed_at,
    exception_reason=excluded.exception_reason,
    exception_note=excluded.exception_note,
    note=excluded.note
`);

const clearItems = sqlite.prepare(`DELETE FROM task_items WHERE task_id = ?`);
const upsertItem = sqlite.prepare(`
  INSERT INTO task_items (
    id, task_id, product_id, spec_id, product_name, spec_label,
    unit_price, quantity, planned_weight, actual_weight
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    task_id=excluded.task_id,
    product_id=excluded.product_id,
    spec_id=excluded.spec_id,
    product_name=excluded.product_name,
    spec_label=excluded.spec_label,
    unit_price=excluded.unit_price,
    quantity=excluded.quantity,
    planned_weight=excluded.planned_weight,
    actual_weight=excluded.actual_weight
`);

const tasks = [
  {
    id: 'demo_pending_alloc',
    merchantId: 'merchant_dongqiao',
    merchantName: '东桥生活超市',
    merchantType: '超市',
    address: '东桥路 18 号后门冷柜区',
    phone: '13800002211',
    routeEta: '明早首趟',
    status: '待配货',
    settlementDay: '每月 5 日',
    plannedWeight: 24,
    actualWeight: 0,
    photoCount: 0,
    completedAt: null,
    exceptionReason: '',
    exceptionNote: '',
    note: '',
    items: [
      ['demo_pending_alloc_1', 'prod_tofu', 'spec_tofu_2', '豆腐', '常规价 ¥2/斤', 2, 12, 0],
      ['demo_pending_alloc_2', 'prod_black_tofu', 'spec_black_tofu_4', '黑豆腐', '常规价 ¥4/斤', 4, 12, 0],
    ],
  },
  {
    id: 'demo_pending_weigh',
    merchantId: 'merchant_liuji',
    merchantName: '刘记早餐摊',
    merchantType: '小商贩',
    address: '城南早市 2 排 6 号',
    phone: '13900003322',
    routeEta: '07:20',
    status: '待复秤',
    settlementDay: '每周日',
    plannedWeight: 18,
    actualWeight: 0,
    photoCount: 0,
    completedAt: null,
    exceptionReason: '',
    exceptionNote: '',
    note: '',
    items: [
      ['demo_pending_weigh_1', 'prod_tofu', 'spec_tofu_25', '豆腐', '精品价 ¥2.5/斤', 2.5, 10, 0],
      ['demo_pending_weigh_2', 'prod_dry_tofu', 'spec_plain_dry_5', '豆干', '未调味 ¥5/斤', 5, 8, 0],
    ],
  },
  {
    id: 'demo_pending_delivery',
    merchantId: 'merchant_dongqiao',
    merchantName: '东桥生活超市',
    merchantType: '超市',
    address: '东桥路 18 号后门冷柜区',
    phone: '13800002211',
    routeEta: '08:00',
    status: '待送达',
    settlementDay: '每月 5 日',
    plannedWeight: 9,
    actualWeight: 9.4,
    photoCount: 2,
    completedAt: null,
    exceptionReason: '',
    exceptionNote: '',
    note: '',
    items: [
      ['demo_pending_delivery_1', 'prod_tofu', 'spec_tofu_2', '豆腐', '常规价 ¥2/斤', 2, 4, 4.1],
      ['demo_pending_delivery_2', 'prod_crispy_tofu', 'spec_crispy_tofu_6', '脆皮豆腐', '常规价 ¥6/斤', 6, 5, 5.3],
    ],
  },
  {
    id: 'demo_completed',
    merchantId: 'merchant_liuji',
    merchantName: '刘记早餐摊',
    merchantType: '小商贩',
    address: '城南早市 2 排 6 号',
    phone: '13900003322',
    routeEta: '07:10',
    status: '已完成',
    settlementDay: '每周日',
    plannedWeight: 12,
    actualWeight: 12,
    photoCount: 2,
    completedAt: '2026-05-08 08:36',
    exceptionReason: '',
    exceptionNote: '',
    note: '',
    items: [
      ['demo_completed_1', 'prod_dry_tofu', 'spec_seasoned_dry_6', '豆干', '调味 ¥6/斤', 6, 12, 12],
    ],
  },
  {
    id: 'demo_exception',
    merchantId: 'merchant_lingshou',
    merchantName: '散户零售',
    merchantType: '散户',
    address: '门店现场自提',
    phone: '',
    routeEta: '',
    status: '异常',
    settlementDay: '当日结清',
    plannedWeight: 6,
    actualWeight: 0,
    photoCount: 0,
    completedAt: null,
    exceptionReason: '客户临时取消',
    exceptionNote: '口头通知取消',
    note: '',
    items: [
      ['demo_exception_1', 'prod_tofu', 'spec_tofu_2', '豆腐', '常规价 ¥2/斤', 2, 6, 0],
    ],
  },
];

for (const task of tasks) {
  upsertTask.run(
    task.id,
    today,
    task.merchantId,
    task.merchantName,
    task.merchantType,
    task.address,
    task.phone,
    task.routeEta,
    task.status,
    task.settlementDay,
    task.plannedWeight,
    task.actualWeight,
    task.photoCount,
    0,
    0,
    0,
    '',
    '老卢',
    task.completedAt,
    task.exceptionReason,
    task.exceptionNote,
    task.note,
  );

  clearItems.run(task.id);
  for (const [id, productId, specId, productName, specLabel, unitPrice, plannedWeight, actualWeight] of task.items) {
    upsertItem.run(
      id,
      task.id,
      productId,
      specId,
      productName,
      specLabel,
      unitPrice,
      1,
      plannedWeight,
      actualWeight,
    );
  }
}

sqlite.close();
console.log('mobile demo tasks ready');
