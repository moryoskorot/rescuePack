// The map owns fire percentages by placed-building ID. Source model IDs only
// describe the window geometry and can occur at more than one map location.
export const FIRE_TICK_SECONDS = 1;

export function setBuildingFire(onFire, worldBuildingId, percent) {
  if (!worldBuildingId) throw new Error('A world building ID is required');
  const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  if (value === 0) onFire.delete(worldBuildingId);
  else onFire.set(worldBuildingId, value);
  return value;
}

export function windowThird(centerY, modelMinY, modelMaxY) {
  const height = Math.max(modelMaxY - modelMinY, 0.00001);
  return Math.min(2, Math.max(0, Math.floor((centerY - modelMinY) / height * 3)));
}

// -1 means clear; 0 means smoke only; 1/2/3 are flame strengths.
export function windowFireStrength(percent, third) {
  if (percent <= 0) return -1;
  if (percent <= 14) return third === 0 ? 0 : -1;
  if (percent <= 33) return third === 0 ? 1 : third === 1 ? 0 : -1;
  if (percent <= 55) return third === 0 ? 2 : third === 1 ? 1 : 0;
  if (percent <= 79) return third === 0 ? 3 : third === 1 ? 2 : 1;
  return 3;
}

// Buildings whose envelope edges are at most 3.5 world units apart count as
// neighbors. A diagonal is measured between the nearest envelope corners.
export function adjacentBuildingIds(sites, maxGap = 3.5) {
  sites = sites.filter(site => site.worldBuildingId);
  const neighbors = new Map(sites.map(site => [site.worldBuildingId, []]));
  for (let i = 0; i < sites.length; i++) for (let j = i + 1; j < sites.length; j++) {
    const a = sites[i], b = sites[j];
    const gapX = Math.max(0, Math.abs(a.x - b.x) - (a.width + b.width) / 2);
    const gapZ = Math.max(0, Math.abs(a.z - b.z) - (a.depth + b.depth) / 2);
    if (Math.hypot(gapX, gapZ) > maxGap) continue;
    neighbors.get(a.worldBuildingId).push(b.worldBuildingId);
    neighbors.get(b.worldBuildingId).push(a.worldBuildingId);
  }
  return neighbors;
}

export function tickBuildingFires(onFire, neighbors, random = Math.random) {
  const additions = new Map();
  // Snapshot the burning buildings so a newly ignited neighbor cannot spread
  // again until the next tick.
  for (const [id, percent] of [...onFire]) {
    if (percent >= 90 && random() < .1) {
      for (const neighbor of neighbors.get(id) ?? []) {
        additions.set(neighbor, (additions.get(neighbor) ?? 0) + 5);
      }
    }
    if (random() < .3) additions.set(id, (additions.get(id) ?? 0) + 1);
  }
  for (const [id, increase] of additions) {
    setBuildingFire(onFire, id, (onFire.get(id) ?? 0) + increase);
  }
}

export function createBuildingFireState(sites, random = Math.random) {
  const onFire = new Map();
  const validIds = new Set(sites.map(site => site.worldBuildingId).filter(Boolean));
  const neighbors = adjacentBuildingIds(sites);
  let elapsed = 0;
  return {
    onFire,
    neighbors,
    set(id, percent) {
      if (!validIds.has(id)) throw new Error(`Unknown world building ID: ${id}`);
      return setBuildingFire(onFire, id, percent);
    },
    update(dt) {
      elapsed += Math.max(0, dt);
      while (elapsed >= FIRE_TICK_SECONDS) {
        tickBuildingFires(onFire, neighbors, random);
        elapsed -= FIRE_TICK_SECONDS;
      }
    },
  };
}
