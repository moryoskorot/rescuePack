import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDING_SITES } from '../src/city-plan.js';
import { adjacentBuildingIds, createBuildingFireState, windowFireStrength, windowThird } from '../src/building-fire.js';

test('world building IDs are stable and distinct from model type IDs', () => {
  const buildings = BUILDING_SITES.filter(site => site.worldBuildingId);
  assert.equal(buildings.length, 46);
  assert.deepEqual(buildings.map(site => site.worldBuildingId),
    buildings.map((_, index) => `WB-${String(index + 1).padStart(3, '0')}`));
  assert.equal(BUILDING_SITES.filter(site => !site.worldBuildingId).length, 8);
  assert.equal(adjacentBuildingIds(BUILDING_SITES).size, buildings.length);
  assert.equal(buildings.some(site => ['building-skyscraper-a', 'building-skyscraper-c'].includes(site.name)), false);
});

test('fire strength follows the requested percentage and building thirds', () => {
  assert.equal(windowThird(.1, 0, 1), 0);
  assert.equal(windowThird(.5, 0, 1), 1);
  assert.equal(windowThird(.9, 0, 1), 2);
  const expected = [
    [0, [-1, -1, -1]], [14, [0, -1, -1]], [15, [1, 0, -1]],
    [33, [1, 0, -1]], [34, [2, 1, 0]], [55, [2, 1, 0]],
    [56, [3, 2, 1]], [79, [3, 2, 1]], [80, [3, 3, 3]],
    [100, [3, 3, 3]],
  ];
  for (const [percent, strengths] of expected) {
    assert.deepEqual([0, 1, 2].map(third => windowFireStrength(percent, third)), strengths);
  }
});

test('zero removes a world building from the fire container', () => {
  const state = createBuildingFireState(BUILDING_SITES, () => 1);
  const id = BUILDING_SITES[0].worldBuildingId;
  state.set(id, 75);
  assert.equal(state.onFire.get(id), 75);
  state.set(id, 0);
  assert.equal(state.onFire.has(id), false);
  assert.throws(() => state.set('B1-01', 50), /Unknown world building ID/);
});

test('one-second ticks grow by 1% at 30% chance and spread 5% at 90%+', () => {
  const sites = [
    { worldBuildingId: 'WB-001', x: 0, z: 0, width: 4, depth: 4 },
    { worldBuildingId: 'WB-002', x: 5, z: 0, width: 4, depth: 4 },
    { worldBuildingId: 'WB-003', x: 30, z: 0, width: 4, depth: 4 },
    { worldBuildingId: 'WB-004', x: 0, z: 5, width: 4, depth: 4 },
  ];
  const values = [0, .2, 1, 1, 1, 1];
  const state = createBuildingFireState(sites, () => values.shift() ?? 1);
  assert.deepEqual(adjacentBuildingIds(sites).get('WB-001'), ['WB-002', 'WB-004']);
  state.set('WB-001', 90);
  state.update(.5);
  assert.equal(state.onFire.get('WB-001'), 90);
  state.update(.5);
  assert.equal(state.onFire.get('WB-001'), 91);
  assert.equal(state.onFire.get('WB-002'), 5);
  assert.equal(state.onFire.get('WB-004'), 5);
  assert.equal(state.onFire.has('WB-003'), false);
  state.update(1);
  assert.equal(state.onFire.get('WB-002'), 5);
});
