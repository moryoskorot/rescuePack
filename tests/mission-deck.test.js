import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYABLE_MISSIONS } from '../src/missions.js';
import { createMissionDeck } from '../src/mission-deck.js';

function memoryStorage() {
  const values = new Map();
  return { getItem:key => values.get(key) ?? null, setItem:(key,value) => values.set(key,value) };
}

test('the phone gives every mission once in a random order and stops at 42 stars', () => {
  const deck = createMissionDeck(PLAYABLE_MISSIONS, memoryStorage(), () => .63);
  const seen = new Set();
  for (let i = 0; i < PLAYABLE_MISSIONS.length; i++) {
    const mission = deck.next();
    assert.ok(mission);
    assert.equal(seen.has(mission.id), false, `Repeated ${mission.id}`);
    seen.add(mission.id);
    assert.equal(deck.next().id, mission.id, 'the pending call stays assigned');
    assert.equal(deck.complete(mission.id), i + 1);
  }
  assert.equal(seen.size, 42);
  assert.equal(deck.completedCount, deck.total);
  assert.equal(deck.next(), null);
});

test('stars and the pending call survive a reload', () => {
  const storage = memoryStorage();
  const first = createMissionDeck(PLAYABLE_MISSIONS, storage, () => 0);
  const completed = first.next();
  first.complete(completed.id);
  const pending = first.next();
  const restored = createMissionDeck(PLAYABLE_MISSIONS, storage, () => .99);
  assert.equal(restored.completedCount, 1);
  assert.equal(restored.next().id, pending.id);
  restored.complete(pending.id);
  assert.notEqual(restored.next().id, completed.id);
});
