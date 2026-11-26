import test from 'node:test';
import assert from 'node:assert/strict';
import { CITYWIDE_FIRE_MISSION, FIRE_MISSIONS, MULTI_FIRE_MISSIONS, PLAYABLE_MISSIONS, RETIRED_FIRE_MISSIONS, validateMissionPoints } from '../src/missions.js';
import { createMissionDeck } from '../src/mission-deck.js';
import { firefighterRank } from '../src/firefighter-ranks.js';

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

test('a skipped call stays unfinished and returns after the waiting calls', () => {
  const missions = bunnyCalls.slice(0, 3);
  const deck = createMissionDeck(missions, memoryStorage(), () => .5);
  const skipped = deck.next();
  deck.skip(skipped.id);
  assert.equal(deck.completedCount, 0);
  assert.equal(deck.current, null);

  const second = deck.next();
  assert.notEqual(second.id, skipped.id);
  deck.complete(second.id);
  const third = deck.next();
  assert.notEqual(third.id, skipped.id);
  deck.complete(third.id);
  assert.equal(deck.next().id, skipped.id);
});


const namedFireCalls = bunnyCalls.filter(mission => mission.type === 'fire');
const fireCalls = [...namedFireCalls, ...FIRE_MISSIONS, ...MULTI_FIRE_MISSIONS, CITYWIDE_FIRE_MISSION];
const fireSaveKey = 'test-fire-save';

test('fresh fire decks reach rank 10 and finish every call across shuffle orders', () => {
  assert.equal(namedFireCalls.length, 13);
  assert.equal(fireCalls.length, 57);
  assert.equal(MULTI_FIRE_MISSIONS.filter(mission => mission.fireCount === 2).length, 23);
  assert.equal(MULTI_FIRE_MISSIONS.filter(mission => mission.fireCount === 3).length, 16);
  for (const random of [() => 0, () => .5, () => .99]) {
    const deck = createMissionDeck(fireCalls, memoryStorage(), random);
    for (let completed = 0; completed < fireCalls.length; completed++) {
      const rank = firefighterRank(deck.fireXp).number;
      const call = deck.next();
      assert.ok(call, `stalled at rank ${rank} after ${completed} calls`);
      assert.ok(validateMissionPoints(call), call.id);
      if (rank < 4) assert.ok(namedFireCalls.includes(call), call.id);
      if (call.fireCandidates) {
        const minimum = { 1: 4, 2: 4, 3: 8, 10: 9 }[call.fireCount];
        assert.ok(rank >= minimum, `${call.id} offered early at rank ${rank}`);
      }
      deck.complete(call.id);
    }
    assert.equal(deck.fireXp, 3025);
    assert.equal(firefighterRank(deck.fireXp).number, 10);
    assert.ok(deck.isComplete);
    assert.equal(deck.next(), null);
  }
});

test('retired calls retain XP and partial fire credit survives reload without double awards', () => {
  const storage = memoryStorage();
  const call = MULTI_FIRE_MISSIONS.find(mission => mission.fireCount === 2);
  const retired = RETIRED_FIRE_MISSIONS.slice(0, 12);
  storage.setItem(fireSaveKey, JSON.stringify({ completedIds: retired.map(mission => mission.id) }));
  const openDeck = () => createMissionDeck([call], storage, () => .5, fireSaveKey, retired);
  const first = openDeck();
  assert.equal(first.fireXp, 300);
  assert.equal(first.completedCount, 0);
  assert.equal(first.next().id, call.id);
  first.recordFires(call.id, 1);
  assert.equal(first.fireXp, 325);
  const restored = openDeck();
  assert.equal(restored.fireXp, 325);
  assert.equal(restored.next().id, call.id);
  restored.recordFires(call.id, 1);
  assert.equal(restored.fireXp, 325);
  restored.recordFires(call.id, 2);
  restored.complete(call.id);
  assert.equal(openDeck().fireXp, 350);
  assert.equal(openDeck().completedCount, 1);
});
