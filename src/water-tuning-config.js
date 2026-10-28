export const WATER_TUNING_DEFAULTS = Object.freeze({
  projectilesPerSecond: 4,
  extinguishPerProjectile: 2,
  waterPerProjectile: 2.5,
  lobAngle: 65,
  lobSpeed: 23,
  waterRegen: 1,
  hydrantRegen: 25,
  waterColor: '#49c9ff',
  projectileSize: 0.4,
  trailAmount: 9,
  trailSpread: 0.22,
  trailSpeed: 1.8,
  trailGravity: 6,
  lastParticleOnly: true,
  streamTrailDuration: 0.55,
});

export function clampWaterTuning(settings) {
  const bounds = {
    projectilesPerSecond: [0.5, 20], extinguishPerProjectile: [0, 20], waterPerProjectile: [0.1, 30],
    lobAngle: [0, 65], lobSpeed: [4, 80], waterRegen: [0, 50], hydrantRegen: [0, 50],
    projectileSize: [0.08, 1.5], trailAmount: [0, 30], trailSpread: [0, 3],
    trailSpeed: [0, 12], trailGravity: [0, 30], streamTrailDuration: [0, 3],
  };
  const result = { ...WATER_TUNING_DEFAULTS };
  for (const [key, [low, high]] of Object.entries(bounds)) {
    const value = Number(settings[key]);
    if (Number.isFinite(value)) result[key] = Math.max(low, Math.min(high, value));
  }
  result.trailAmount = Math.round(result.trailAmount);
  result.lastParticleOnly = Boolean(settings.lastParticleOnly);
  if (/^#[0-9a-fA-F]{6}$/.test(settings.waterColor ?? '')) result.waterColor = settings.waterColor;
  return result;
}

export function loadWaterTuning() {
  try {
    const saved = JSON.parse(localStorage.getItem('rescuePack.waterTuning') || '{}');
    // Apply the requested arc once to existing tuning saved before this change.
    if ((saved.schemaVersion ?? 1) < 3) saved.lobAngle = 65;
    return clampWaterTuning({ ...WATER_TUNING_DEFAULTS, ...saved });
  }
  catch { return { ...WATER_TUNING_DEFAULTS }; }
}

export function saveWaterTuning(settings) {
  const clean = clampWaterTuning(settings);
  localStorage.setItem('rescuePack.waterTuning', JSON.stringify({ ...clean, schemaVersion: 3 }));
  return clean;
}
