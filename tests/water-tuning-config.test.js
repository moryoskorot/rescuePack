import test from 'node:test';
import assert from 'node:assert/strict';
import { WATER_TUNING_DEFAULTS } from '../src/water-tuning-config.js';

test('the default water recharge rate is 1% per second', () => {
  assert.equal(WATER_TUNING_DEFAULTS.waterRegen, 1);
});
