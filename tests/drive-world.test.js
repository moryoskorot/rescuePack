import test from 'node:test';
import assert from 'node:assert/strict';
import { createVehicleState, VEHICLE_STEP, vehicleFootprint } from '../src/vehicle-physics.js';
import { SHORE_BARRIERS, footprintOnLandOrPier } from '../src/world-layout.js';
import { advanceVehicle } from '../src/drive-world.js';

test('holding the accelerator at the shore and pier end never crosses water', () => {
  for (const [x,z] of [[0,70],[12,90],[24,74]]) {
    const player=createVehicleState({x,z,heading:0,vz:24});
    let stopped=false;
    for(let frame=0;frame<1200;frame++) {
      stopped=advanceVehicle(player,{throttle:1},VEHICLE_STEP,SHORE_BARRIERS).blocked || stopped;
      assert.equal(footprintOnLandOrPier(player),true);
    }
    assert.equal(stopped,true);
    assert.equal(player.vz,0);
  }
});

test('front-bumper collision stops the truck and reverse lets it back away', () => {
  const player=createVehicleState({x:0,z:0,heading:0,vz:20});
  const wall=[{x:0,z:12,w:20,d:1}];
  for(let frame=0;frame<360;frame++)advanceVehicle(player,{throttle:1},VEHICLE_STEP,wall);
  const stoppedZ=player.z;
  assert.ok(Math.max(...vehicleFootprint(player).map(p=>p.z))<=11.5);
  for(let frame=0;frame<120;frame++)advanceVehicle(player,{throttle:-1},VEHICLE_STEP,wall);
  assert.ok(player.z<stoppedZ-1);
});
