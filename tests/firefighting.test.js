import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBuildingFireState } from '../src/building-fire.js';
import { buildingImpactPoint, createFirefightingProgress, igniteRandomBuildings, nearestBurningBuilding } from '../src/firefighting.js';
import { createFirefightingEffect } from '../src/firefighting-effect.js';
import { createHoseProjectiles } from '../src/hose-projectiles.js';
import { nearestWindowTarget, segmentWindowHit, worldWindowTargets } from '../src/window-targets.js';
import { WATER_TUNING_DEFAULTS } from '../src/water-tuning-config.js';
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

test('only a shot crossing a transformed window rectangle counts as a hit', () => {
  const object = new THREE.Group();
  object.position.set(10,0,0); object.scale.setScalar(2);
  const mapped = [{id:'B1-01-W01',side:'-X',corners:[[0,1,-.5],[0,1,.5],[0,2,.5],[0,2,-.5]]}];
  const windows=worldWindowTargets(THREE,object,mapped);
  assert.equal(windows[0].center.x,10);
  assert.equal(windows[0].normal.x,-1);
  assert.equal(nearestWindowTarget(new THREE.Vector3(0,3,0),windows).id,'B1-01-W01');
  assert.equal(segmentWindowHit(new THREE.Vector3(0,3,0),new THREE.Vector3(20,3,0),windows).window.id,'B1-01-W01');
  assert.equal(segmentWindowHit(new THREE.Vector3(0,6,0),new THREE.Vector3(20,6,0),windows),null);
  assert.equal(segmentWindowHit(new THREE.Vector3(0,3,3),new THREE.Vector3(20,3,3),windows),null);
});

test('four projectiles spend 10 water in one second and remove 2 fire points each only after impact', () => {
  const fire = createBuildingFireState(sites);
  const progress = createFirefightingProgress(fire);
  const tank = createWaterBoostState();
  fire.set('WB-001', 56);
  const object=new THREE.Group();object.position.set(10,0,0);
  const windows=worldWindowTargets(THREE,object,[{id:'W1',corners:[[0,2,-1],[0,2,1],[0,4,1],[0,4,-1]]}]);
  let fired=0,hits=0;
  const hose=createHoseProjectiles(THREE,(id,windowId,point,reduction)=>{hits++;progress.apply(id,reduction);},()=>{fired++;});
  const nozzle=new THREE.Vector3(0,3,0),forward=new THREE.Vector3(1,0,0);
  const target={worldBuildingId:'WB-001',windows};
  for(let i=0;i<120;i++)hose.update(1/120,nozzle,forward,target,tank,WATER_TUNING_DEFAULTS);
  assert.equal(fired,4);
  assert.equal(tank.charge,90);
  assert.ok(hits<4,'the most recent shot is still flying');
  for(let i=0;i<70;i++)hose.update(1/120,nozzle,forward,null,tank,WATER_TUNING_DEFAULTS);
  assert.equal(hits,4);
  assert.equal(fire.onFire.get('WB-001'),48);
});

test('aim approaches a window over about a second rather than snapping to it', () => {
  const tank=createWaterBoostState();tank.charge=0;
  const hose=createHoseProjectiles(THREE,()=>{});
  const nozzle=new THREE.Vector3(),forward=new THREE.Vector3(1,0,0);
  const target={worldBuildingId:'WB-001',windows:[{id:'W1',center:new THREE.Vector3(10,3,10),normal:new THREE.Vector3(0,0,1)}]};
  const first=hose.update(.1,nozzle,forward,target,tank,WATER_TUNING_DEFAULTS).aim.clone();
  assert.ok(first.distanceTo(target.windows[0].center)>5);
  let later;
  for(let i=0;i<84;i++)later=hose.update(1/60,nozzle,forward,target,tank,WATER_TUNING_DEFAULTS).aim.clone();
  assert.ok(later.distanceTo(target.windows[0].center)<.5);
});

test('launched water stays in world space when the truck moves', () => {
  const tank=createWaterBoostState();
  const hose=createHoseProjectiles(THREE,()=>{});
  const object=new THREE.Group();object.position.x=12;
  const windows=worldWindowTargets(THREE,object,[{id:'W1',side:'-X',corners:[[0,2,-2],[0,2,2],[0,5,2],[0,5,-2]]}]);
  const nozzle=new THREE.Vector3(0,3,0),forward=new THREE.Vector3(1,0,0);
  const target={worldBuildingId:'WB-001',windows};
  hose.update(.25,nozzle,forward,target,tank,WATER_TUNING_DEFAULTS);
  const first=hose.state.shots[0];
  const start=first.start.clone(),end=first.end.clone();
  nozzle.x=3;
  hose.update(.05,nozzle,forward,target,tank,WATER_TUNING_DEFAULTS);
  assert.deepEqual(first.start,start);
  assert.deepEqual(first.end,end);
  assert.notEqual(first.position.x,first.start.x);
});

test('projectile ribbon and droplets fade after the shot finishes', () => {
  const scene = new THREE.Scene();
  const truck=new THREE.Group();scene.add(truck);
  const hose = createFirefightingEffect(THREE,scene);
  const camera=new THREE.PerspectiveCamera(50,1,.1,100);camera.position.set(0,5,20);
  const shot={position:new THREE.Vector3(0,2,0)};
  hose.update([shot],.05,WATER_TUNING_DEFAULTS,camera);
  shot.position.set(1,2,0);
  hose.update([shot],.05,WATER_TUNING_DEFAULTS,camera);
  const [ribbon,cloud]=scene.children.slice(1);
  assert.equal(ribbon.parent,scene);
  assert.equal(cloud.parent,scene);
  assert.equal(ribbon.geometry.drawRange.count,6);
  const a=ribbon.geometry.attributes.position;
  assert.ok(Math.abs(Math.hypot(a.getX(0)-a.getX(1),a.getY(0)-a.getY(1),a.getZ(0)-a.getZ(1))
    -WATER_TUNING_DEFAULTS.projectileSize)<1e-5,'ribbon width matches the projectile size');
  assert.ok(cloud.geometry.drawRange.count>=1);
  hose.update([],1,WATER_TUNING_DEFAULTS,camera);
  assert.equal(ribbon.geometry.drawRange.count,0);
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
