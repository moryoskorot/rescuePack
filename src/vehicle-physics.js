// Kenney's firetruck faces local +Z. Heading is the model's Three.js rotation.y,
// so positive yaw turns left; input.steer is positive for the driver's right.
// Keep velocity in world coordinates: rotating the body must not rotate momentum.
export const VEHICLE_STEP = 1 / 120;

// Measured from public/assets/cars/firetruck.glb. Wheel node pivots are at
// x=+/-.4, but their geometry extends another .3 outward: tread centers are
// x=+/-.55. The model's wheel bottoms are already at y=0.
const scale = 1.75;
export const FIRETRUCK = Object.freeze({
  scale,
  wheelbase: 1.62 * scale,
  frontAxle: .96 * scale,
  rearAxle: -.66 * scale,
  halfTrack: .55 * scale,
  tireWidth: .22 * scale,
  tireRadius: .3 * scale,
  halfWidth: .75 * scale,
  front: 1.7 * scale,
  rear: 1.7 * scale,
  groundOffset: 0,
});

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const approach = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));

export function createVehicleState(values = {}) {
  return { x: 0, z: 0, heading: 0, vx: 0, vz: 0, steeringAngle: 0, yawRate: 0, wheelSpin: 0, ...values };
}

export function vehicleBasis(heading) {
  const sin = Math.sin(heading), cos = Math.cos(heading);
  return { forwardX: sin, forwardZ: cos, rightX: -cos, rightZ: sin };
}

export function vehicleLocalToWorld(state, x, z) {
  const sin = Math.sin(state.heading), cos = Math.cos(state.heading);
  // Exactly the x/z components of THREE.Matrix4.makeRotationY(heading).
  return { x: state.x + x * cos + z * sin, z: state.z - x * sin + z * cos };
}

export function wheelContacts(state, axle = 'rear') {
  const z = axle === 'front' ? FIRETRUCK.frontAxle : FIRETRUCK.rearAxle;
  // Kenney names local -X 'right' and local +X 'left'.
  return [-FIRETRUCK.halfTrack, FIRETRUCK.halfTrack].map(x => vehicleLocalToWorld(state, x, z));
}

export function vehicleFootprint(state, margin = 0) {
  return [
    [-FIRETRUCK.halfWidth - margin, FIRETRUCK.front + margin],
    [FIRETRUCK.halfWidth + margin, FIRETRUCK.front + margin],
    [FIRETRUCK.halfWidth + margin, -FIRETRUCK.rear - margin],
    [-FIRETRUCK.halfWidth - margin, -FIRETRUCK.rear - margin],
  ].map(([x, z]) => vehicleLocalToWorld(state, x, z));
}

// Separating axis test for the oriented truck and an axis-aligned building or
// prop. Testing the complete rectangle keeps its nose and rear out of walls.
export function vehicleIntersectsBounds(state, bounds, margin = 0) {
  const sin = Math.sin(state.heading), cos = Math.cos(state.heading);
  const halfWidth = FIRETRUCK.halfWidth + margin;
  const halfLength = (FIRETRUCK.front + FIRETRUCK.rear) / 2 + margin;
  const centerShift = (FIRETRUCK.front - FIRETRUCK.rear) / 2;
  const dx = state.x + sin * centerShift - bounds.x;
  const dz = state.z + cos * centerShift - bounds.z;
  const bw = bounds.w / 2, bd = bounds.d / 2;
  for (const [ax, az] of [[1, 0], [0, 1], [cos, -sin], [sin, cos]]) {
    const separation = Math.abs(dx * ax + dz * az);
    const truckRadius = halfWidth * Math.abs(cos * ax - sin * az) + halfLength * Math.abs(sin * ax + cos * az);
    const boundsRadius = bw * Math.abs(ax) + bd * Math.abs(az);
    if (separation >= truckRadius + boundsRadius) return false;
  }
  return true;
}

export function vehicleMotion(state) {
  const basis = vehicleBasis(state.heading);
  const forwardSpeed = state.vx * basis.forwardX + state.vz * basis.forwardZ;
  const lateralSpeed = state.vx * basis.rightX + state.vz * basis.rightZ;
  return { speed: Math.hypot(state.vx, state.vz), forwardSpeed, lateralSpeed };
}

// Advance at a fixed 120 Hz in the caller, then handle collisions before drawing
// wheelContacts. Throttle: -1 reverse/brake, +1 forward/brake. Steer: -1 left,
// +1 right. Pressing the opposite pedal brakes to zero before engaging reverse.
export function stepVehicle(state, input, dt = VEHICLE_STEP) {
  if (!Number.isFinite(dt) || dt <= 0) return vehicleMotion(state);
  const throttle = clamp(input.throttle || 0, -1, 1);
  const steer = clamp(input.steer || 0, -1, 1);
  const handbrake = Boolean(input.handbrake);
  const basis = vehicleBasis(state.heading);
  const motion = vehicleMotion(state);
  let forwardSpeed = motion.forwardSpeed;

  const braking = throttle !== 0 && forwardSpeed * throttle < -.12;
  if (braking) {
    // Never jump directly from forward travel into reverse during one step.
    const change = Math.min(Math.abs(forwardSpeed), 23 * Math.abs(throttle) * dt);
    const acceleration = -Math.sign(forwardSpeed) * change;
    state.vx += basis.forwardX * acceleration;
    state.vz += basis.forwardZ * acceleration;
  } else if (throttle !== 0) {
    const limit = throttle > 0 ? 24 : 9;
    const engineForce = throttle > 0 ? 12.5 : 8;
    const available = clamp(1 - Math.max(0, forwardSpeed * Math.sign(throttle)) / limit, 0, 1);
    state.vx += basis.forwardX * throttle * engineForce * available * dt;
    state.vz += basis.forwardZ * throttle * engineForce * available * dt;
  }

  const rollingDrag = throttle === 0 ? .42 : .045;
  const drag = Math.exp(-(rollingDrag + (handbrake ? .58 : 0)) * dt);
  state.vx *= drag;
  state.vz *= drag;
  forwardSpeed = state.vx * basis.forwardX + state.vz * basis.forwardZ;

  // A real front axle sets the turning radius. Reduce steering lock at speed
  // so ordinary corners feel planted, with progressive handbrake oversteer.
  const speed = Math.hypot(state.vx, state.vz);
  const steeringLock = .55 / (1 + speed * .065);
  state.steeringAngle = approach(state.steeringAngle, steer * steeringLock, 9, dt);
  const drift = handbrake && speed > 3;
  const bicycleYaw = -forwardSpeed / FIRETRUCK.wheelbase * Math.tan(state.steeringAngle);
  const targetYaw = clamp(bicycleYaw * (drift ? 1.22 : 1), -1.8, 1.8);
  state.yawRate = approach(state.yawRate, targetYaw, drift ? 5 : 12, dt);
  if (speed < .08) state.yawRate = 0;
  state.heading += state.yawRate * dt;

  // Front tires keep steering, while the handbrake releases rear lateral grip.
  // Correct only the sideways component of the existing WORLD velocity. This
  // preserves inertia through a slide instead of snapping travel to the nose.
  const nextBasis = vehicleBasis(state.heading);
  const nextForward = state.vx * nextBasis.forwardX + state.vz * nextBasis.forwardZ;
  const sideSpeed = state.vx * nextBasis.rightX + state.vz * nextBasis.rightZ;
  const rearToCenter = -FIRETRUCK.rearAxle;
  const rollingSideSpeed = -state.yawRate * rearToCenter;
  const lateralGrip = drift ? .75 : 18;
  const correctedSideSpeed = approach(sideSpeed, rollingSideSpeed, lateralGrip, dt);
  state.vx += nextBasis.rightX * (correctedSideSpeed - sideSpeed);
  state.vz += nextBasis.rightZ * (correctedSideSpeed - sideSpeed);

  if (throttle === 0 && Math.hypot(state.vx, state.vz) < .05) {
    state.vx = 0;
    state.vz = 0;
    state.yawRate = 0;
  }
  state.x += state.vx * dt;
  state.z += state.vz * dt;
  state.wheelSpin += nextForward / FIRETRUCK.tireRadius * dt;
  const result = vehicleMotion(state);
  return { ...result, braking, drifting: drift && (Math.abs(result.lateralSpeed) > .7 || Math.abs(state.yawRate) > .2) };
}
