import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {advanceJetGrowth, createWaterEffect} from '../src/water-effect.js';
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

test('boost droplets stay in world space, land, and leave temporary ovals', () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: () => ({getContext: () => ({beginPath() {}, arc() {}, fill() {}})}),
  };
  try {
    const scene = new THREE.Scene(), truck = new THREE.Group();
    scene.add(truck);
    const effect = createWaterEffect(THREE, scene, truck, () => 0, () => 'road');
    const droplets = scene.children.find(item => item.isPoints);
    const ovals = scene.children.find(item => item.isMesh);
    for (let i = 0; i < 4; i++) effect.update(true, i * .05, .05);
    assert.ok(droplets.geometry.drawRange.count > 0);
    const firstX = droplets.geometry.attributes.position.getX(0);
    truck.position.x = 20;
    effect.update(false, .2, .01);
    assert.ok(Math.abs(droplets.geometry.attributes.position.getX(0) - firstX) < 1);
    let landed = false;
    for (let i = 0; i < 20; i++) {
      effect.update(false, .21 + i * .05, .05);
      landed ||= ovals.geometry.drawRange.count > 0;
    }
    assert.ok(landed);
    for (let i = 0; i < 30; i++) effect.update(false, 1.21 + i * .05, .05);
    assert.equal(droplets.geometry.drawRange.count, 0);
    assert.equal(ovals.geometry.drawRange.count, 0);
  } finally {
    globalThis.document = previousDocument;
  }
});
