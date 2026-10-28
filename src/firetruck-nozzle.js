// Coordinates in the firetruck GLB, before its 1.75 game scale. The body roof
// reaches y=1.7; this point sits just above the center of its roof equipment.
export const FIRETRUCK_NOZZLE_LOCAL = Object.freeze({ x: 0, y: 1.76, z: -0.15 });

export function firetruckNozzleWorld(model, target) {
  target.set(FIRETRUCK_NOZZLE_LOCAL.x, FIRETRUCK_NOZZLE_LOCAL.y, FIRETRUCK_NOZZLE_LOCAL.z);
  return model.localToWorld(target);
}
