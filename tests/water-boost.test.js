import test from 'node:test';
import assert from 'node:assert/strict';
import { WATER_RESTART_LEVEL, HYDRANT_REFILL_RADIUS, createWaterBoostState, nearbyHydrant, stepWaterBoost } from '../src/water-boost.js';
import { HYDRANT_LOCATIONS, SHORE_BARRIERS, footprintOnLandOrPier } from '../src/world-layout.js';
import { VEHICLE_STEP, createVehicleState, vehicleMotion, stepVehicle } from '../src/vehicle-physics.js';
import { advanceVehicle } from '../src/drive-world.js';

const fireStationHydrant = HYDRANT_LOCATIONS.find(location => location.name === 'Fire station');
const farAway = { x: 0, z: -80 };

test('water refills at exactly 1% per second away from hydrants and 25% near them', () => {
  const tank = createWaterBoostState();
  tank.charge = 20;
  stepWaterBoost(tank, farAway, {}, 10);
  assert.equal(tank.charge, 30);
  assert.equal(tank.nearHydrant, null);
  stepWaterBoost(tank, fireStationHydrant, {}, 2);
  assert.equal(tank.charge, 80);
  assert.equal(tank.nearHydrant, fireStationHydrant);
  stepWaterBoost(tank, fireStationHydrant, {}, 10);
  assert.equal(tank.charge, 100);
});

test('a hydrant refills during automatic spraying while ordinary refill waits for the hose', () => {
  const tank=createWaterBoostState();tank.charge=20;tank.spraying=true;
  stepWaterBoost(tank,farAway,{},1,[]);
  assert.equal(tank.charge,20);
  stepWaterBoost(tank,fireStationHydrant,{},1);
  assert.equal(tank.charge,45);
});

test('the recharge radius reaches the adjacent road but ends outside its boundary', () => {
  assert.equal(nearbyHydrant({x:fireStationHydrant.x-HYDRANT_REFILL_RADIUS,z:fireStationHydrant.z}), fireStationHydrant);
  assert.equal(nearbyHydrant({x:fireStationHydrant.x-HYDRANT_REFILL_RADIUS-.1,z:fireStationHydrant.z}), null);
});

test('water boosts only with forward throttle, drains near hydrants, and waits for release when empty', () => {
  const tank = createWaterBoostState();
  tank.charge = 9;
  stepWaterBoost(tank, fireStationHydrant, {held:true,throttle:0}, 1);
  assert.equal(tank.charge, 34);
  assert.equal(tank.active, false);
  stepWaterBoost(tank, fireStationHydrant, {held:true,throttle:1}, 1);
  assert.equal(tank.charge, 16);
  assert.equal(tank.active, true);
  stepWaterBoost(tank, fireStationHydrant, {held:true,throttle:1}, 1);
  assert.equal(tank.charge, 0);
  assert.equal(tank.needsRelease, true);
  stepWaterBoost(tank, fireStationHydrant, {held:true,throttle:1}, 1);
  assert.equal(tank.charge, 25);
  assert.equal(tank.active, false);
  stepWaterBoost(tank, fireStationHydrant, {held:false,throttle:1}, 1);
  assert.ok(tank.charge >= WATER_RESTART_LEVEL);
  assert.equal(tank.needsRelease, false);
  stepWaterBoost(tank, fireStationHydrant, {held:true,throttle:1}, 1);
  assert.equal(tank.active, true);
});

test('water boost makes the firetruck faster while preserving shore collision', () => {
  const ordinary = createVehicleState(), boosted = createVehicleState();
  for(let i=0;i<3/VEHICLE_STEP;i++) {
    stepVehicle(ordinary,{throttle:1},VEHICLE_STEP);
    stepVehicle(boosted,{throttle:1,boost:true},VEHICLE_STEP);
  }
  assert.ok(vehicleMotion(boosted).speed > vehicleMotion(ordinary).speed * 1.45);
  const shore = createVehicleState({x:0,z:70,heading:0,vz:24});
  for(let i=0;i<3/VEHICLE_STEP;i++) {
    advanceVehicle(shore,{throttle:1,boost:true},VEHICLE_STEP,SHORE_BARRIERS);
    assert.equal(footprintOnLandOrPier(shore),true);
  }
  assert.equal(shore.vz,0);
});
