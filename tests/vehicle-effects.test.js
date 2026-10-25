import assert from 'node:assert/strict';
import test from 'node:test';
import {advanceJetGrowth} from '../src/water-effect.js';
import {soundLevels} from '../src/vehicle-sound.js';

test('water jet extends over several frames and retracts after release', () => {
  let growth = 0;
  growth = advanceJetGrowth(growth, true, .1);
  assert.ok(growth > 0 && growth < .3);
  growth = advanceJetGrowth(growth, true, .2);
  assert.ok(growth > .6 && growth < 1);
  growth = advanceJetGrowth(growth, true, .2);
  assert.equal(growth, 1);
  growth = advanceJetGrowth(growth, false, .1);
  assert.ok(growth > 0 && growth < 1);
  assert.equal(advanceJetGrowth(growth, false, 1), 0);
});

test('driving and braking sounds follow motion, not idle button presses', () => {
  const parked = soundLevels({speed: 0, throttle: 0, handbrake: true});
  const driving = soundLevels({speed: 18, throttle: 1});
  const braking = soundLevels({speed: 18, throttle: 0, handbrake: true});
  const boosting = soundLevels({speed: 18, throttle: 1, boost: true});
  assert.equal(parked.brakeGain, 0);
  assert.ok(driving.enginePitch > parked.enginePitch);
  assert.ok(driving.engineGain > parked.engineGain);
  assert.ok(braking.brakeGain > 0);
  assert.equal(driving.boostGain, 0);
  assert.ok(boosting.boostGain > 0);
});
