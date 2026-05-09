import assert from 'node:assert/strict';
import {
  getTaskItemSettings,
  normalizeTaskItemInput,
  setTaskItemSettings,
} from '../src/shared/task-item.js';

assert.deepEqual(getTaskItemSettings(), { basketWeightJin: 12 }, '默认一筐应该是12斤');
assert.deepEqual(
  normalizeTaskItemInput({ displayAmount: 2, displayUnit: '筐' }),
  { displayAmount: 2, displayUnit: '筐', plannedWeight: 24 },
  '默认配置下2筐应该是24斤',
);

setTaskItemSettings({ basketWeightJin: 15 });

assert.deepEqual(getTaskItemSettings(), { basketWeightJin: 15 }, '运行时应该能更新一筐默认斤数');
assert.deepEqual(
  normalizeTaskItemInput({ displayAmount: 2, displayUnit: '筐' }),
  { displayAmount: 2, displayUnit: '筐', plannedWeight: 30 },
  '更新配置后新换算应该立即生效',
);

setTaskItemSettings({ basketWeightJin: 0 });

assert.deepEqual(getTaskItemSettings(), { basketWeightJin: 12 }, '非法配置应该回退到12斤');

console.log('task item settings regression test passed');
