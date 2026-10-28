const STORAGE_KEY = 'rescue-pack-mission-progress-v1';

// One call is held until it is completed. Closing the phone or reloading the
// page cannot draw a replacement and completed calls are never drawn again.
export function createMissionDeck(missions, storage = globalThis.localStorage, random = Math.random) {
  const byId = new Map(missions.map(mission => [mission.id, mission]));
  let saved = {};
  try { saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '{}') ?? {}; } catch { /* Browsers may block storage. */ }
  const completedIds = new Set((Array.isArray(saved.completedIds) ? saved.completedIds : [])
    .filter(id => byId.has(id)));
  let currentId = byId.has(saved.currentId) && !completedIds.has(saved.currentId) ? saved.currentId : null;

  function persist() {
    try { storage?.setItem(STORAGE_KEY, JSON.stringify({completedIds:[...completedIds],currentId})); }
    catch { /* Keep progress for this session when storage is unavailable. */ }
  }

  return {
    get completedCount() { return completedIds.size; },
    get total() { return missions.length; },
    get current() { return byId.get(currentId) ?? null; },
    get isComplete() { return completedIds.size === missions.length; },
    next() {
      if (currentId) return byId.get(currentId);
      const available = missions.filter(mission => !completedIds.has(mission.id));
      if (!available.length) return null;
      const index = Math.min(available.length - 1, Math.max(0, Math.floor(random() * available.length)));
      currentId = available[index].id;
      persist();
      return available[index];
    },
    complete(id) {
      if (id !== currentId) throw new Error(`Cannot complete an unassigned mission: ${id}`);
      completedIds.add(id);
      currentId = null;
      persist();
      return completedIds.size;
    },
  };
}
