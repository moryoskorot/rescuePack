import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { firefighterRank } from '../src/firefighter-ranks.js';

test('firefighter rank starts at Rookie and advances with fire completion percentage', () => {
  assert.deepEqual(firefighterRank(0, 0), firefighterRank(0, 90));
  assert.equal(firefighterRank(0, 90).name, 'Rookie');
  assert.equal(firefighterRank(9, 90).number, 1);
  assert.equal(firefighterRank(10, 90).name, 'Ember Scout');
  assert.equal(firefighterRank(5, 45).number, 2);
  assert.equal(firefighterRank(89, 90).number, 9);
  assert.equal(firefighterRank(90, 90).name, 'Supreme Chief');
});

test('every promotion has its numbered insignia asset', () => {
  for (let completed = 0; completed <= 9; completed++) {
    const rank = firefighterRank(completed, 9);
    assert.equal(rank.number, completed + 1);
    assert.ok(rank.insignia.startsWith(String(rank.number).padStart(2, '0')));
    assert.ok(existsSync(new URL(`../public/assets/ranks/${rank.insignia}`, import.meta.url)));
  }
});
