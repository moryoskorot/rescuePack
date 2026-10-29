export const HOSE_RANGE = 17.6;

export function nearestBurningBuilding(position, sites, onFire, range = HOSE_RANGE) {
  let nearest = null;
  for (const site of sites) {
    if (!site.worldBuildingId || !onFire.has(site.worldBuildingId)) continue;
    const dx = Math.max(0, Math.abs(position.x - site.x) - site.width / 2);
    const dz = Math.max(0, Math.abs(position.z - site.z) - site.depth / 2);
    const distance = Math.hypot(dx, dz);
    if (distance <= range && (!nearest || distance < nearest.distance)) nearest = { site, distance };
  }
  return nearest;
}

export function buildingImpactPoint(position, site, bounds) {
  const minX = bounds?.min.x ?? site.x - site.width / 2;
  const maxX = bounds?.max.x ?? site.x + site.width / 2;
  const minZ = bounds?.min.z ?? site.z - site.depth / 2;
  const maxZ = bounds?.max.z ?? site.z + site.depth / 2;
  const x = Math.max(minX, Math.min(maxX, position.x));
  const z = Math.max(minZ, Math.min(maxZ, position.z));
  const baseY = bounds?.min.y ?? 0;
  const height = bounds ? bounds.max.y - bounds.min.y : 5;
  return { x, y: baseY + Math.min(3.3, Math.max(1.7, height * .32)), z };
}

export function igniteRandomBuildings(fireState, sites, random = Math.random, count = 4) {
  fireState.clear();
  const choices = sites.filter(site => site.worldBuildingId);
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  const ignited = choices.slice(0, count);
  for (const site of ignited) fireState.set(site.worldBuildingId, 45 + Math.floor(random() * 31));
  return ignited;
}

export function createFirefightingProgress(fireState) {
  const fractions = new Map();
  const hitIds = new Set();
  return {
    clear() { fractions.clear(); hitIds.clear(); },
    hasHit(worldBuildingId) { return hitIds.has(worldBuildingId); },
    apply(worldBuildingId, reductionPoints) {
      const burning = fireState.onFire.get(worldBuildingId) ?? 0;
      if (!burning || reductionPoints <= 0) return burning;
      hitIds.add(worldBuildingId);
      const reduction = (fractions.get(worldBuildingId) ?? 0) + reductionPoints;
      const whole = Math.floor(reduction + 1e-9);
      if (whole) fireState.set(worldBuildingId, burning - whole);
      if (fireState.onFire.has(worldBuildingId)) fractions.set(worldBuildingId, reduction - whole);
      else fractions.delete(worldBuildingId);
      return fireState.onFire.get(worldBuildingId) ?? 0;
    },
  };
}
