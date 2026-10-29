const STORAGE_KEY = 'rescue-pack-mission-progress-v1';

// A call stays on the phone during this play session. A new page load shuffles
// the remaining calls while keeping completed stars and avoiding the last offer.
export function createMissionDeck(missions, storage = globalThis.localStorage, random = Math.random) {
  const byId = new Map(missions.map(mission => [mission.id, mission]));
  let saved = {};
  try { saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '{}') ?? {}; } catch { /* Browsers may block storage. */ }
  const completedIds = new Set((Array.isArray(saved.completedIds) ? saved.completedIds : [])
    .filter(id => byId.has(id)));
  let lastOfferedId = saved.lastOfferedId ?? saved.currentId ?? null;
  let currentId = null;
  let queue = null;

  function startSession() {
    if (queue) return;
    queue = missions.filter(mission => !completedIds.has(mission.id)).map(mission => mission.id);
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    if (queue.length > 1 && queue[0] === lastOfferedId) {
      const alternate = 1 + Math.min(queue.length - 2, Math.max(0, Math.floor(random() * (queue.length - 1))));
      [queue[0], queue[alternate]] = [queue[alternate], queue[0]];
    }
  }

  function persist() {
    try { storage?.setItem(STORAGE_KEY, JSON.stringify({completedIds:[...completedIds],lastOfferedId})); }
    catch { /* Keep progress for this session when storage is unavailable. */ }
  }

  return {
    get completedCount() { return completedIds.size; },
    get total() { return missions.length; },
    get current() { return byId.get(currentId) ?? null; },
    get isComplete() { return completedIds.size === missions.length; },
    startSession,
    next() {
      startSession();
      if (currentId) return byId.get(currentId);
      currentId = queue.shift() ?? null;
      if (!currentId) return null;
      lastOfferedId = currentId;
      persist();
      return byId.get(currentId);
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
