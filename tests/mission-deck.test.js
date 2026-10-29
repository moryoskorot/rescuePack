import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYABLE_MISSIONS } from '../src/missions.js';
import { createMissionDeck } from '../src/mission-deck.js';

function memoryStorage() {
  const values = new Map();
  return { getItem:key => values.get(key) ?? null, setItem:(key,value) => values.set(key,value) };
}

const bunnyCalls = PLAYABLE_MISSIONS.filter(mission => mission.character_id !== 'bunny');

test('Bunny receives every other character call once in a shuffled order', () => {
  assert.equal(bunnyCalls.length, 39);
  const deck = createMissionDeck(bunnyCalls, memoryStorage(), () => .63);
  deck.startSession();
  const seen = new Set();
  for (let i = 0; i < bunnyCalls.length; i++) {
    const mission = deck.next();
    assert.ok(mission);
    assert.notEqual(mission.character_id, 'bunny');
    assert.equal(seen.has(mission.id), false, `Repeated ${mission.id}`);
    seen.add(mission.id);
    assert.equal(deck.next().id, mission.id, 'the pending call stays assigned');
    assert.equal(deck.complete(mission.id), i + 1);
  }
  assert.equal(seen.size, 39);
  assert.equal(deck.completedCount, deck.total);
  assert.equal(deck.next(), null);
});

test('stars survive a reload while the next session gets a different call', () => {
  const storage = memoryStorage();
  const first = createMissionDeck(bunnyCalls, storage, () => .99);
  const completed = first.next();
  first.complete(completed.id);
  const pending = first.next();
  assert.equal(first.next().id, pending.id, 'closing the phone keeps the call this session');
  const restored = createMissionDeck(bunnyCalls, storage, () => .99);
  assert.equal(restored.completedCount, 1);
  assert.equal(restored.current, null);
  const fresh = restored.next();
  assert.notEqual(fresh.id, pending.id, 'refresh does not repeat the last offer');
  assert.notEqual(fresh.id, completed.id, 'completed calls stay out of the deck');
});
