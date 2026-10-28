import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYABLE_MISSIONS, createMissionProgress, validateMissionPoints } from '../src/missions.js';

test('fourteen mission prototypes use supported buildings or reachable interaction points', () => {
  assert.equal(PLAYABLE_MISSIONS.length, 14);
  assert.equal(new Set(PLAYABLE_MISSIONS.map(mission => mission.id)).size, 14);
  for (const mission of PLAYABLE_MISSIONS) assert.equal(validateMissionPoints(mission), true, mission.id);
});

test('three book boxes in separate districts each provide two books', () => {
  const mission = PLAYABLE_MISSIONS.find(entry => entry.id === 'sheep_03');
  assert.equal(mission.pickups.length, 3);
  assert.equal(new Set(mission.pickups.map(point => point.district)).size, 3);
  for (let i = 0; i < mission.pickups.length; i++) for (let j = i + 1; j < mission.pickups.length; j++) {
    assert.ok(Math.hypot(mission.pickups[i].x - mission.pickups[j].x, mission.pickups[i].z - mission.pickups[j].z) > 60);
  }
  const progress = createMissionProgress(mission);
  mission.pickups.forEach((point, index) => {
    progress.update(point);
    assert.equal(progress.collectedCount, (index + 1) * 2);
  });
  assert.equal(progress.stage, 'returning');
  assert.equal(progress.collectedCount, 6);
  progress.update(mission.target);
  assert.equal(progress.stage, 'complete');
});

test('the gym and library have separate entrances', () => {
  const gym = PLAYABLE_MISSIONS.find(entry => entry.id === 'horse_02').target;
  const library = PLAYABLE_MISSIONS.find(entry => entry.id === 'sheep_03').target;
  assert.ok(Math.hypot(gym.x - library.x, gym.z - library.z) >= 60);
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
