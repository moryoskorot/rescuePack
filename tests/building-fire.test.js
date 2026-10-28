import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDING_SITES } from '../src/city-plan.js';
import { adjacentBuildingIds, createBuildingFireState, windowFireStrength, windowThird } from '../src/building-fire.js';
import { INDUSTRIAL_CHIMNEYS, chimneyFireStrength } from '../src/industrial-chimneys.js';
import * as THREE from 'three';
import { AFTER_FIRE_SMOKE_SECONDS, createBuildingFireEffect } from '../src/building-fire-effect.js';

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

test('only large tubular industrial chimneys emit smoke, then medium fire', () => {
  assert.deepEqual(Object.keys(INDUSTRIAL_CHIMNEYS).sort(),
    ['b', 'c', 'e', 'f', 'l', 'm', 'n'].map(letter => `industrial/building-${letter}`).sort());
  assert.ok(Object.values(INDUSTRIAL_CHIMNEYS).every(chimneys => chimneys.length > 0));
  assert.equal(chimneyFireStrength(0), -1);
  assert.equal(chimneyFireStrength(1), 0);
  assert.equal(chimneyFireStrength(80), 0);
  assert.equal(chimneyFireStrength(81), 2);
  assert.equal(chimneyFireStrength(100), 2);
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

test('fire emits from every mapped facade regardless of the camera angle or distance', () => {
  const scene = new THREE.Scene();
  const state = { onFire: new Map([['WB-001',100]]) };
  const effect = createBuildingFireEffect(THREE,scene,state);
  const object = new THREE.Group();
  effect.registerBuilding('WB-001',object,[
    {side:'+X',center:[8,1.5,0],width:2,height:1},
    {side:'-X',center:[-8,1.5,0],width:2,height:1},
    {side:'+Z',center:[0,1.5,8],width:2,height:1},
    {side:'-Z',center:[0,1.5,-8],width:2,height:1},
  ],0,3);
  const camera = new THREE.PerspectiveCamera(50,1,.1,400);
  camera.position.set(250,10,0);
  effect.update(1,camera);
  const flame=scene.children[0].geometry;
  const points=Array.from({length:flame.drawRange.count},(_,i)=>[
    flame.attributes.position.getX(i),flame.attributes.position.getZ(i),
  ]);
  for(const [x,z] of [[8,0],[-8,0],[0,8],[0,-8]])
    assert.ok(points.some(([px,pz])=>Math.hypot(px-x,pz-z)<2),`missing flame at facade ${x},${z}`);
});

test('smoke keeps emitting after a fire reaches zero, rises, then fades completely', () => {
  const originalRandom=Math.random;
  Math.random=()=>.5;
  try {
  const scene=new THREE.Scene();
  const state={onFire:new Map([['WB-001',100]])};
  const effect=createBuildingFireEffect(THREE,scene,state);
  effect.registerBuilding('WB-001',new THREE.Group(),[
    {side:'+Z',center:[0,1,0],width:2,height:1},
    {side:'+Z',center:[3,1,0],width:2,height:1},
    {side:'+Z',center:[6,1,0],width:2,height:1},
  ],0,3);
  const camera=new THREE.PerspectiveCamera(50,1,.1,400);camera.position.set(0,6,20);
  effect.update(.5,camera);
  state.onFire.delete('WB-001');
  for(let i=0;i<70;i++)effect.update(.1,camera);
  const smoke=scene.children[1].geometry;
  assert.ok(smoke.drawRange.count>0,'smoke should remain after flames and first smoke particles expire');
  const heights=Array.from({length:smoke.drawRange.count},(_,i)=>smoke.attributes.position.getY(i));
  assert.ok(heights.some(y=>y>5),'smoke should rise well above the window');
  for(let i=0;i<40;i++)effect.update(.1,camera);
  assert.equal(smoke.drawRange.count,0);
  assert.equal(scene.children[0].geometry.drawRange.count,0);
  assert.equal(AFTER_FIRE_SMOKE_SECONDS,3.5);
  } finally { Math.random=originalRandom; }
});
