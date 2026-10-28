import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYABLE_MISSIONS, createMissionProgress, validateMissionPoints } from '../src/missions.js';

test('authored collection spots are on reachable surfaces with draft spacing', () => {
  const collect = PLAYABLE_MISSIONS.find(mission => mission.id === 'sheep_03');
  assert.equal(validateMissionPoints(collect), true);
  assert.equal(collect.pickups.length, collect.mechanics.item_count);
});

test('collecting every book reveals the return destination before completion', () => {
  const mission = PLAYABLE_MISSIONS.find(entry => entry.id === 'sheep_03');
  const progress = createMissionProgress(mission);
  for (const point of mission.pickups) progress.update(point);
  assert.equal(progress.stage, 'returning');
  assert.equal(progress.collectedCount, 6);
  progress.update(mission.target);
  assert.equal(progress.stage, 'complete');
});

test('arrival and firefighting missions have different completion triggers', () => {
  const fire = createMissionProgress(PLAYABLE_MISSIONS.find(entry => entry.id === 'pig_01'));
  fire.update({ x: -98, z: -51 });
  assert.equal(fire.stage, 'going');
  fire.update({ x: -98, z: -51 }, true);
  assert.equal(fire.stage, 'complete');
  const fixMission = PLAYABLE_MISSIONS.find(entry => entry.id === 'horse_02');
  const fix = createMissionProgress(fixMission);
  fix.update(fixMission.target);
  assert.equal(fix.stage, 'complete');
});
