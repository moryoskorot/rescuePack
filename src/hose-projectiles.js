import { WATER_TUNING_DEFAULTS } from './water-tuning-config.js';
import { nearestWindowTarget, segmentWindowHit } from './window-targets.js';

const AIM_TIME = 1.25;

export function projectilePoint(THREE, shot, progress) {
  const p = shot.start.clone().lerp(shot.end, progress);
  const distance = Math.hypot(shot.end.x - shot.start.x, shot.end.z - shot.start.z);
  p.y += 4 * Math.sin(shot.angle * Math.PI / 180) * distance * .24 * progress * (1 - progress);
  return p;
}

export function createHoseProjectiles(THREE, onHit, onShot = () => {}) {
  let shots = [], aim = null, targetId = null, clock = 0;
  const state = { shots: [], aim: null, spraying: false };
  function update(dt, nozzle, forward, target, tank, config = WATER_TUNING_DEFAULTS) {
    const windows = target?.windows ?? [];
    const nearest = target ? nearestWindowTarget(nozzle, windows) : null;
    const wanted = nearest?.center ?? null;
    if (!aim) aim = nozzle.clone().addScaledVector(forward, 13);
    // Target changes do not teleport the nozzle's aim.
    if (wanted) aim.lerp(wanted, 1 - Math.exp(-dt * 3 / AIM_TIME));
    else aim.copy(nozzle).addScaledVector(forward, 13);
    state.aim = aim.clone();
    targetId = target?.worldBuildingId ?? null;
    const rate = config.projectilesPerSecond;
    clock = wanted && tank.charge >= config.waterPerProjectile ? clock + dt : 0;
    let fired = 0;
    while (wanted && clock + 1e-9 >= 1 / rate && tank.charge >= config.waterPerProjectile && fired < 3) {
      clock = Math.max(0, clock - 1 / rate);
      fired++;
      const distance = nozzle.distanceTo(wanted);
      const direction = aim.clone().sub(nozzle).normalize();
      const end = nozzle.clone().addScaledVector(direction, distance);
      const duration = Math.max(.18, distance / config.lobSpeed);
      const shot = { start: nozzle.clone(), end, position: nozzle.clone(), previous: nozzle.clone(),
        age: 0, duration, angle: config.lobAngle, worldBuildingId: targetId, windows,
        trail: [], droplets: [], hit: false };
      shots.push(shot);
      tank.charge = Math.max(0, tank.charge - config.waterPerProjectile);
      onShot(shot);
    }
    state.spraying = fired > 0 || Boolean(wanted && tank.charge >= config.waterPerProjectile);
    for (const shot of shots) {
      shot.previous.copy(shot.position);
      shot.age += dt;
      shot.position.copy(projectilePoint(THREE, shot, Math.min(1, shot.age / shot.duration)));
      let hit = segmentWindowHit(shot.previous, shot.position, shot.windows);
      // The eased aim approaches its target asymptotically. At the end of a
      // flight, carry the droplet a little past its visual endpoint so a shot
      // centered on the glass still crosses the mapped window plane.
      if (!hit && shot.age >= shot.duration) {
        const forward = shot.end.clone().sub(shot.start).normalize();
        hit = segmentWindowHit(shot.position, shot.position.clone().addScaledVector(forward, 1.5), shot.windows);
      }
      if (hit) { shot.hit = true; shot.position.copy(hit.point); onHit(shot.worldBuildingId, hit.window.id, hit.point, config.extinguishPerProjectile); }
      if (shot.age >= shot.duration && !hit) shot.expired = true;
    }
    shots = shots.filter(shot => !shot.hit && !shot.expired);
    state.shots = shots;
    return state;
  }
  return { update, state, reset() { shots = []; aim = null; clock = 0; state.shots = []; state.spraying = false; } };
}
