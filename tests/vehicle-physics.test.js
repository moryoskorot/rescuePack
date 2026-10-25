import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Matrix4, Vector3 } from 'three';
import { FIRETRUCK, VEHICLE_STEP, createVehicleState, stepVehicle, vehicleBasis, vehicleLocalToWorld, vehicleMotion, wheelContacts, vehicleIntersectsBounds } from '../src/vehicle-physics.js';

const near = (actual, expected, epsilon = 1e-6) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} differs from ${expected}`);
function simulate(state, input, seconds) {
  for (let i = 0; i < Math.round(seconds / VEHICLE_STEP); i++) stepVehicle(state, input, VEHICLE_STEP);
  return state;
}

test('forward always points toward the GLB grille, at every cardinal heading', () => {
  for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const state = simulate(createVehicleState({ heading }), { throttle: 1 }, 1);
    const renderedNose = new Vector3(0, 0, 1).applyMatrix4(new Matrix4().makeRotationY(heading));
    near(state.vx / Math.hypot(state.vx, state.vz), renderedNose.x);
    near(state.vz / Math.hypot(state.vx, state.vz), renderedNose.z);
  }
});

test('right steering turns a moving front axle right, and reverses yaw while backing up', () => {
  const forward = simulate(createVehicleState({ vz: 8 }), { throttle: 1, steer: 1 }, .6);
  const reverse = simulate(createVehicleState({ vz: -6 }), { throttle: -1, steer: 1 }, .6);
  assert.ok(forward.heading < -.1, 'right steering decreases model yaw going forward');
  assert.ok(forward.x < -.2, 'forward right turn follows the nose toward local -X');
  assert.ok(reverse.heading > .1, 'the same wheel angle reverses body yaw in reverse');
  assert.ok(reverse.z < 0, 'reverse continues backwards');
  const stopped = simulate(createVehicleState(), { steer: 1, handbrake: true }, 1);
  near(stopped.heading, 0);
  near(stopped.x, 0);
});

test('opposite throttle brakes before reversing, without instantaneous direction changes', () => {
  const state = createVehicleState({ vz: 14 });
  stepVehicle(state, { throttle: -1 });
  assert.ok(state.vz > 13 && state.vz < 14);
  simulate(state, { throttle: -1 }, .8);
  assert.ok(state.vz < 0, 'holding reverse eventually engages reverse after stopping');
  const backwards = createVehicleState({ vz: -5 });
  stepVehicle(backwards, { throttle: 1 });
  assert.ok(backwards.vz < 0 && backwards.vz > -5);
});

test('handbrake preserves world momentum and produces more slip than ordinary turning', () => {
  const normal = simulate(createVehicleState({ vz: 16 }), { steer: 1, throttle: 1 }, .55);
  const drift = simulate(createVehicleState({ vz: 16 }), { steer: 1, throttle: 1, handbrake: true }, .55);
  const normalMotion = vehicleMotion(normal), driftMotion = vehicleMotion(drift);
  assert.ok(Math.abs(driftMotion.lateralSpeed) > Math.abs(normalMotion.lateralSpeed) + 1.5);
  assert.ok(drift.vz > 8, 'truck keeps its original momentum while the nose turns');
  assert.ok(Math.abs(drift.heading) > .25);
  assert.ok(driftMotion.speed < normalMotion.speed, 'handbrake costs speed');
  simulate(drift, { throttle: 1 }, 1);
  assert.ok(Math.abs(vehicleMotion(drift).lateralSpeed) < .1, 'tires recover grip on release');
});

test('physics is stable over sustained steering, braking, and handbrake inputs', () => {
  const state = createVehicleState();
  for (let i = 0; i < 120 * 45; i++) {
    stepVehicle(state, { throttle: i % 900 < 650 ? 1 : -1, steer: Math.sin(i / 200), handbrake: i % 600 > 420 });
    for (const value of Object.values(state)) assert.ok(Number.isFinite(value));
    assert.ok(vehicleMotion(state).speed < 30);
  }
});

test('rotated physical bounds stop the front bumper and rear from crossing walls', () => {
  const northWall = { x: 0, z: 6, w: 20, d: 2 };
  assert.equal(vehicleIntersectsBounds(createVehicleState({ z: 1.9 }), northWall), false);
  assert.equal(vehicleIntersectsBounds(createVehicleState({ z: 2.1 }), northWall), true);
  assert.equal(vehicleIntersectsBounds(createVehicleState({ z: 2.1, heading: Math.PI }), northWall), true);
  const eastWall = { x: 6, z: 0, w: 2, d: 20 };
  assert.equal(vehicleIntersectsBounds(createVehicleState({ x: 2.1, heading: Math.PI / 2 }), eastWall), true);
  assert.equal(vehicleIntersectsBounds(createVehicleState({ x: 2.1, heading: 0 }), eastWall), false);
  // A small prop inside the truck's broad-phase AABB but outside its actual
  // rotated rectangle must remain passable.
  assert.equal(vehicleIntersectsBounds(createVehicleState({ heading: Math.PI / 4 }), { x: 2.7, z: -2.7, w: .25, d: .25 }), false);
});

test('rear tire contact centers match actual GLB geometry and Three transforms', () => {
  const glb = readFileSync(new URL('../public/assets/cars/firetruck.glb', import.meta.url));
  const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
  const wheelPosition = name => {
    const node = gltf.nodes.find(n => n.name === name);
    const accessor = gltf.accessors[gltf.meshes[node.mesh].primitives[0].attributes.POSITION];
    return { x: (node.translation[0] + (accessor.min[0] + accessor.max[0]) / 2) * FIRETRUCK.scale,
      y: (node.translation[1] + accessor.min[1]) * FIRETRUCK.scale,
      z: node.translation[2] * FIRETRUCK.scale };
  };
  const front = wheelPosition('wheel-front-right');
  const rear = [wheelPosition('wheel-back-right'), wheelPosition('wheel-back-left')];
  near(front.z - rear[0].z, FIRETRUCK.wheelbase);
  const grille = gltf.nodes.find(n => n.name === 'grill');
  assert.ok(grille.translation[2] > front.z / FIRETRUCK.scale, 'grille is in front of front axle at +Z');
  for (const heading of [0, .3, -1.7, Math.PI]) {
    const state = createVehicleState({ x: 17, z: -6, heading });
    wheelContacts(state).forEach((actual, i) => {
      near(rear[i].y, 0);
      const rendered = new Vector3(rear[i].x, 0, rear[i].z).applyMatrix4(new Matrix4().makeRotationY(heading));
      near(actual.x, rendered.x + state.x);
      near(actual.z, rendered.z + state.z);
      const frontContact = wheelContacts(state, 'front')[i];
      const basis = vehicleBasis(heading);
      near((frontContact.x - actual.x) * basis.forwardX + (frontContact.z - actual.z) * basis.forwardZ, FIRETRUCK.wheelbase);
    });
    const transformed = vehicleLocalToWorld(state, .8, 1.2);
    const rendered = new Vector3(.8, 0, 1.2).applyMatrix4(new Matrix4().makeRotationY(heading));
    near(transformed.x, rendered.x + state.x);
    near(transformed.z, rendered.z + state.z);
  }
});
