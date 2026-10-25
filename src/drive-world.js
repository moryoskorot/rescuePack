import { FIRETRUCK, stepVehicle, vehicleMotion, vehicleIntersectsBounds } from './vehicle-physics.js';
import { footprintOnLandOrPier } from './world-layout.js';

export function advanceVehicle(player, input, dt, obstacles) {
  const previous = { ...player };
  const motion = stepVehicle(player, input, dt);
  const blocked = !footprintOnLandOrPier(player, FIRETRUCK)
    || obstacles.some(bounds => vehicleIntersectsBounds(player, bounds, .025));
  if (!blocked) return { ...motion, blocked: false };
  player.x = previous.x;
  player.z = previous.z;
  player.heading = previous.heading;
  player.vx = 0;
  player.vz = 0;
  player.yawRate = 0;
  player.wheelSpin = previous.wheelSpin;
  return { ...vehicleMotion(player), blocked: true, drifting: false };
}
