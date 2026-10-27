import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBuildingFireState } from '../src/building-fire.js';
import { buildingImpactPoint, createFirefightingProgress, igniteRandomBuildings, nearestBurningBuilding } from '../src/firefighting.js';
import { createFirefightingEffect } from '../src/firefighting-effect.js';
import { edgeMarkerLayout } from '../src/fire-markers.js';
import { interpolateVehiclePose } from '../src/render-pose.js';
import { createWaterBoostState, stepWaterBoost } from '../src/water-boost.js';

const sites = [
  { worldBuildingId:'WB-001',name:'house-a',x:10,z:0,width:8,depth:8 },
  { worldBuildingId:'WB-002',name:'house-b',x:35,z:0,width:8,depth:8 },
  { worldBuildingId:'WB-003',name:'house-c',x:60,z:0,width:8,depth:8 },
  { worldBuildingId:'WB-004',name:'house-d',x:85,z:0,width:8,depth:8 },
  { worldBuildingId:'WB-005',name:'house-e',x:110,z:0,width:8,depth:8 },
];

test('a new game ignites four distinct world buildings and clears the previous fire', () => {
  const fire = createBuildingFireState(sites);
  fire.set('WB-005', 100);
  const chosen = igniteRandomBuildings(fire, sites, () => .35);
  assert.equal(chosen.length, 4);
  assert.equal(fire.onFire.size, 4);
  assert.equal(new Set(chosen.map(site => site.worldBuildingId)).size, 4);
  assert.ok([...fire.onFire.values()].every(percent => percent >= 45 && percent <= 75));
});

test('hose reaches the nearest burning footprint and aims at its wall', () => {
  const fire = createBuildingFireState(sites);
  fire.set('WB-001', 55);fire.set('WB-002', 70);
  const target = nearestBurningBuilding({x:20,z:0},sites,fire.onFire);
  assert.equal(target.site.worldBuildingId,'WB-001');
  assert.equal(target.distance,6);
  assert.equal(nearestBurningBuilding({x:60,z:50},sites,fire.onFire),null);
  const impact = buildingImpactPoint({x:20,z:1},target.site,{min:{x:6,y:0,z:-4},max:{x:14,y:8,z:4}});
  assert.deepEqual(impact,{x:14,y:2.56,z:1});
});

test('33 water per second removes 28 fire points and zero removes the fire', () => {
  const fire = createBuildingFireState(sites);
  const progress = createFirefightingProgress(fire);
  const tank = createWaterBoostState();
  fire.set('WB-001', 56);
  stepWaterBoost(tank,{x:0,z:0},{held:true,firefighting:true},1,[]);
  assert.equal(tank.charge,67);
  assert.equal(tank.spraying,true);
  assert.equal(tank.active,false);
  progress.apply('WB-001',tank.usedThisStep);
  assert.equal(fire.onFire.get('WB-001'),28);
  stepWaterBoost(tank,{x:0,z:0},{held:true,firefighting:true},1,[]);
  progress.apply('WB-001',tank.usedThisStep);
  assert.equal(fire.onFire.has('WB-001'),false);
  assert.equal(tank.charge,34);
  tank.charge=10;
  stepWaterBoost(tank,{x:0,z:0},{held:true,firefighting:true},1,[]);
  assert.equal(tank.usedThisStep,10);
  assert.equal(tank.charge,0);
  assert.equal(tank.needsRelease,true);
});

test('hose strand grows toward the target and retracts after release', () => {
  const scene = new THREE.Scene();
  const hose = createFirefightingEffect(THREE,scene);
  const start = new THREE.Vector3(0,2,0),end = new THREE.Vector3(10,3,0);
  hose.update(true,start,end,.5);
  const [core,spray]=scene.children;
  assert.ok(core.geometry.drawRange.count > 100);
  assert.ok(spray.geometry.drawRange.count > 100);
  assert.ok(Math.abs(core.geometry.attributes.position.getX(core.geometry.drawRange.count-1)-10)<.1);
  hose.update(false,null,null,.5);
  assert.equal(core.geometry.drawRange.count,0);
  assert.equal(spray.geometry.drawRange.count,0);
});

test('fire markers grow nearby and stay on the viewport edge', () => {
  const far=edgeMarkerLayout(1,-1,160,800,600);
  const near=edgeMarkerLayout(1,-1,0,800,600);
  assert.ok(near.scale>far.scale);
  assert.ok(near.x>400 && near.x<800 && near.y>0 && near.y<300);
});

test('render pose interpolates fixed physics steps and heading wrap', () => {
  const pose=interpolateVehiclePose({x:0,z:0,heading:Math.PI-.1,wheelSpin:0,steeringAngle:0},{x:2,z:4,heading:-Math.PI+.1,wheelSpin:2,steeringAngle:.2},.5);
  assert.equal(pose.x,1);assert.equal(pose.z,2);
  assert.ok(Math.abs(pose.heading-Math.PI)<.01);
  assert.equal(pose.wheelSpin,1);
});
