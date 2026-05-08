import assert from 'node:assert/strict';
import { comparePendingTasks, formatTaskItemMeasure, normalizeTaskItemInput } from '../src/shared/task-item.js';

assert.deepEqual(
  normalizeTaskItemInput({ displayAmount: 3, displayUnit: '公斤' }),
  { displayAmount: 3, displayUnit: '公斤', plannedWeight: 6 },
  '3公斤应该换算成6斤',
);

assert.deepEqual(
  normalizeTaskItemInput({ displayAmount: 2, displayUnit: '筐' }),
  { displayAmount: 2, displayUnit: '筐', plannedWeight: 24 },
  '2筐默认按24斤估算',
);

assert.equal(formatTaskItemMeasure(3, '公斤'), '3公斤', '公斤展示格式不对');
assert.equal(formatTaskItemMeasure(1, '筐'), '1筐', '筐展示格式不对');
assert.equal(formatTaskItemMeasure(2.5, '斤'), '2.5斤', '斤展示格式不对');

const pendingTasks = [
  { id: 'c', taskDate: '2026-05-09', status: '待送达', createdAt: '2026-05-08 08:00:00' },
  { id: 'b', taskDate: '2026-05-10', status: '待配货', createdAt: '2026-05-08 07:00:00' },
  { id: 'a', taskDate: '2026-05-09', status: '待配货', createdAt: '2026-05-08 09:00:00' },
  { id: 'd', taskDate: '2026-05-09', status: '待复秤', createdAt: '2026-05-08 06:00:00' },
];

pendingTasks.sort(comparePendingTasks);

assert.deepEqual(
  pendingTasks.map(task => task.id),
  ['a', 'd', 'c', 'b'],
  '待处理应该先按日期，再按状态顺序排序',
);

console.log('task item regression test passed');
