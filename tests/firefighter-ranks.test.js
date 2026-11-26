import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { firefighterRank } from '../src/firefighter-ranks.js';

const thresholds = [0, 50, 150, 300, 550, 825, 1125, 1450, 1800, 2175];

test('firefighter ranks advance at the specified XP thresholds', () => {
  assert.equal(firefighterRank(0).name, 'Rookie');
  for (const [index, xp] of thresholds.entries()) {
    const rank = firefighterRank(xp);
    assert.equal(rank.number, index + 1);
    assert.equal(rank.startXp, xp);
    assert.equal(rank.nextXp, thresholds[index + 1] ?? null);
    if (index) assert.equal(firefighterRank(xp - 25).number, index);
  }
  assert.equal(firefighterRank(3025).name, 'Supreme Chief');
});

test('every promotion has its numbered insignia asset', () => {
  for (const xp of thresholds) {
    const rank = firefighterRank(xp);
    assert.ok(rank.insignia.startsWith(String(rank.number).padStart(2, '0')));
    assert.ok(existsSync(new URL(`../public/assets/ranks/${rank.insignia}`, import.meta.url)));
  }
});
