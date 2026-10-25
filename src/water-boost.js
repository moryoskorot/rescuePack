import { HYDRANT_LOCATIONS } from './world-layout.js';

export const WATER_CAPACITY = 100;
export const WATER_USE_PER_SECOND = 18;
export const NORMAL_REFILL_PER_SECOND = 1;
export const HYDRANT_REFILL_PER_SECOND = 25;
export const WATER_RESTART_LEVEL = 5;
// The hydrants sit on sidewalks. This reaches a truck in the adjacent lane.
export const HYDRANT_REFILL_RADIUS = 9.5;

export function createWaterBoostState() {
  return { charge: WATER_CAPACITY, active: false, nearHydrant: null, needsRelease: false };
}

export function nearbyHydrant(position, hydrants = HYDRANT_LOCATIONS) {
  const limitSquared = HYDRANT_REFILL_RADIUS ** 2;
  let nearest = null;
  let nearestSquared = limitSquared;
  for (const hydrant of hydrants) {
    const distanceSquared = (position.x - hydrant.x) ** 2 + (position.z - hydrant.z) ** 2;
    if (distanceSquared <= nearestSquared) {
      nearest = hydrant;
      nearestSquared = distanceSquared;
    }
  }
  return nearest;
}

// Charge is a percentage. During a water jet there is no background refill;
// releasing it restores exactly 1%/s, or 25%/s near a hydrant.
export function stepWaterBoost(state, position, { held = false, throttle = 0 } = {}, dt, hydrants = HYDRANT_LOCATIONS) {
  if (!Number.isFinite(dt) || dt <= 0) return state;
  state.nearHydrant = nearbyHydrant(position, hydrants);
  if (!held && state.charge >= WATER_RESTART_LEVEL) state.needsRelease = false;
  const usingWater = held && throttle > 0 && state.charge > 0 && !state.needsRelease;
  if (usingWater) {
    state.charge = Math.max(0, state.charge - WATER_USE_PER_SECOND * dt);
    if (state.charge === 0) state.needsRelease = true;
  } else {
    const rate = state.nearHydrant ? HYDRANT_REFILL_PER_SECOND : NORMAL_REFILL_PER_SECOND;
    state.charge = Math.min(WATER_CAPACITY, state.charge + rate * dt);
  }
  state.active = usingWater;
  return state;
}
