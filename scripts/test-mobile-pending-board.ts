import assert from 'node:assert/strict';
import { PENDING_GROUP_ORDER, groupPendingTasks } from '../src/pages/mobile/task-board.js';

assert.deepEqual(
  PENDING_GROUP_ORDER,
  ['待配货', '待复秤', '待送达'],
  '待处理分组必须只保留待配货、待复秤、待送达',
);

const grouped = groupPendingTasks([
  { id: 'a', status: '待配货' },
  { id: 'b', status: '待复秤' },
  { id: 'c', status: '待送达' },
  { id: 'e', status: '已完成' },
]);

assert.deepEqual(
  grouped.map(group => group.status),
  ['待配货', '待复秤', '待送达'],
  '待处理页应该只展示三种待处理状态',
);

console.log('mobile pending board regression test passed');
