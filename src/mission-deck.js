import { FIRE_XP, firefighterRank } from './firefighter-ranks.js';

const STORAGE_KEY = 'rescue-pack-mission-progress-v1';

// A call stays on the phone during this play session. A new page load shuffles
// the remaining calls while keeping completed stars and avoiding the last offer.
export function createMissionDeck(missions, storage = globalThis.localStorage, random = Math.random, storageKey = STORAGE_KEY, retiredMissions = []) {
  const byId = new Map(missions.map(mission => [mission.id, mission]));
  const retiredById = new Map(retiredMissions.map(mission => [mission.id, mission]));
  let saved = {};
  try { saved = JSON.parse(storage?.getItem(storageKey) ?? '{}') ?? {}; } catch { /* Browsers may block storage. */ }
  const completedIds = new Set((Array.isArray(saved.completedIds) ? saved.completedIds : [])
    .filter(id => byId.has(id)));
  const retiredCompletedIds = (Array.isArray(saved.completedIds) ? saved.completedIds : [])
    .filter(id => retiredById.has(id));
  const fireCredits = new Map();
  for (const mission of missions) {
    const count = saved.fireCredits?.[mission.id];
    if (mission.fireCount && !completedIds.has(mission.id) && Number.isInteger(count) && count > 0) {
      fireCredits.set(mission.id, Math.min(count, mission.fireCount));
    }
  }
  let fires = [...new Set([...completedIds, ...retiredCompletedIds])]
    .reduce((total, id) => total + ((byId.get(id) ?? retiredById.get(id)).fireCount ?? 0), 0);
  for (const count of fireCredits.values()) fires += count;

  let lastOfferedId = saved.lastOfferedId ?? saved.currentId ?? null;
  let currentId = null;
  let queue = null;

  function available(id) {
    const minimum = byId.get(id).minimumFireRank;
    return !minimum || firefighterRank(fires * FIRE_XP).number >= minimum;
  }

  function startSession() {
    if (queue) return;
    queue = missions.filter(mission => !completedIds.has(mission.id)).map(mission => mission.id);
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    const availableIndices = queue.flatMap((id, index) => available(id) ? [index] : []);
    const [first] = availableIndices;
    if (availableIndices.length > 1 && queue[first] === lastOfferedId) {
      const alternate = availableIndices[1 + Math.min(availableIndices.length - 2,
        Math.max(0, Math.floor(random() * (availableIndices.length - 1))))];
      [queue[first], queue[alternate]] = [queue[alternate], queue[first]];
    }
  }

  function persist() {
    try { storage?.setItem(storageKey, JSON.stringify({
      completedIds: [...completedIds, ...retiredCompletedIds],
      lastOfferedId,
      ...(fireCredits.size && { fireCredits: Object.fromEntries(fireCredits) }),
    })); }
    catch { /* Keep progress for this session when storage is unavailable. */ }
  }

  return {
    get completedCount() { return completedIds.size; },
    get fireXp() { return fires * FIRE_XP; },
    get total() { return missions.length; },
    get current() { return byId.get(currentId) ?? null; },
    get isComplete() { return completedIds.size === missions.length; },
    startSession,
    next() {
      startSession();
      if (currentId) return byId.get(currentId);
      const index = queue.findIndex(available);
      if (index === -1) return null;
      [currentId] = queue.splice(index, 1);
      lastOfferedId = currentId;
      persist();
      return byId.get(currentId);
    },
    recordFires(id, extinguishedCount) {
      if (!id || id !== currentId || !Number.isInteger(extinguishedCount)) return;
      // Only award the best count for a call, so retries cannot farm XP.
      const credited = fireCredits.get(id) ?? 0;
      const count = Math.min(extinguishedCount, byId.get(id).fireCount ?? 0);
      if (count <= credited) return;
      fires += count - credited;
      fireCredits.set(id, count);
      persist();
    },
    complete(id) {
      if (!id || id !== currentId) throw new Error(`Cannot complete an unassigned mission: ${id}`);
      fires += (byId.get(id).fireCount ?? 0) - (fireCredits.get(id) ?? 0);
      fireCredits.delete(id);
      completedIds.add(id);
      currentId = null;
      persist();
      return completedIds.size;
    },
    skip(id) {
      if (!id || id !== currentId) throw new Error(`Cannot skip an unassigned mission: ${id}`);
      currentId = null;
      // Put a declined call back after the calls still waiting this session.
      queue.push(id);
      persist();
    },
  };
}
