import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYABLE_MISSIONS, createMissionProgress, validateMissionPoints } from '../src/missions.js';

test('every authored mission uses its own destination or reachable interaction points', () => {
  assert.equal(PLAYABLE_MISSIONS.length, 42);
  assert.equal(new Set(PLAYABLE_MISSIONS.map(mission => mission.id)).size, 42);
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
  progress.update(mission.target, false, 1.9);
  assert.equal(progress.stage, 'returning');
  assert.equal(progress.holdProgress, .95);
  progress.update({x: mission.target.x + 20, z: mission.target.z}, false, .2);
  assert.equal(progress.holdProgress, 0, 'leaving the marker resets the return timer');
  progress.update({...mission.target, speed: 3}, false, .5);
  assert.equal(progress.holdProgress, 0, 'driving through the marker does not count as standing');
  progress.update(mission.target, false, 2);
  assert.equal(progress.stage, 'complete');
});

test('the gym and library have separate entrances', () => {
  const gym = PLAYABLE_MISSIONS.find(entry => entry.id === 'horse_02').target;
  const library = PLAYABLE_MISSIONS.find(entry => entry.id === 'sheep_03').target;
  assert.ok(Math.hypot(gym.x - library.x, gym.z - library.z) >= 60);
});

test('arrival and firefighting missions have different completion triggers', () => {
  const fire = createMissionProgress(PLAYABLE_MISSIONS.find(entry => entry.id === 'pig_01'));
  fire.update(PLAYABLE_MISSIONS.find(entry => entry.id === 'pig_01').target);
  assert.equal(fire.stage, 'going');
  fire.update(PLAYABLE_MISSIONS.find(entry => entry.id === 'pig_01').target, true);
  assert.equal(fire.stage, 'complete');
  const fixMission = PLAYABLE_MISSIONS.find(entry => entry.id === 'horse_02');
  const fix = createMissionProgress(fixMission);
  fix.update(fixMission.target, false, 5.9);
  assert.equal(fix.stage, 'going');
  assert.ok(fix.holdProgress > .98);
  fix.update({x: fixMission.target.x + 20, z: fixMission.target.z}, false, .1);
  assert.equal(fix.holdProgress, 0);
  fix.update(fixMission.target, false, 6);
  assert.equal(fix.stage, 'complete');
});

test('missions do not complete at the starting position without an action', () => {
  for (const mission of PLAYABLE_MISSIONS) {
    const progress = createMissionProgress(mission);
    progress.update({...mission.target, speed: 0}, false, 0);
    assert.notEqual(progress.stage, 'complete', mission.id);
  }
  const rescueMission = PLAYABLE_MISSIONS.find(entry => entry.type === 'rescue');
  const rescue = createMissionProgress(rescueMission);
  rescue.update({...rescueMission.target, speed: 0}, false, 1.9);
  assert.notEqual(rescue.stage, 'complete');
  rescue.update({...rescueMission.target, speed: 0}, false, .1);
  assert.equal(rescue.stage, 'complete');
});

test('the optional ring run follows eight ordered road checkpoints', () => {
  const mission = PLAYABLE_MISSIONS.find(entry => entry.id === 'panda_03');
  const progress = createMissionProgress(mission);
  progress.update(mission.route[1]);
  assert.equal(progress.checkpoint, 0);
  for (const [index,point] of mission.route.entries()) {
    progress.update(point);
    assert.equal(progress.checkpoint, index + 1);
  }
  assert.equal(progress.stage, 'complete');
});
