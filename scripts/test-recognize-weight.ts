import assert from 'node:assert/strict';
import { extractWeightFromText } from '../server/utils/weigh-recognizer.js';

const direct = extractWeightFromText('{"weight":12.3,"unit":"斤","rawText":"12.3"}');
assert.ok(direct, 'JSON 重量结果应该可识别');
assert.equal(direct.weight, 12.3, '斤单位应该原样返回');

const kg = extractWeightFromText('重量 6.2kg');
assert.ok(kg, '公斤单位结果应该可识别');
assert.equal(kg.weight, 12.4, '公斤应该自动换算成斤');

const plain = extractWeightFromText('稳定后显示 15.6');
assert.ok(plain, '纯数字结果应该可识别');
assert.equal(plain.weight, 15.6, '纯数字应直接取重量');

console.log('recognize weight regression test passed');
