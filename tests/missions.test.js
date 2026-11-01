import test from 'node:test';
import assert from 'node:assert/strict';
import { CITYWIDE_FIRE_MISSION, FIRE_MISSIONS, GANTON_DELIVERY_MISSION, MULTI_FIRE_MISSIONS, PLAYABLE_MISSIONS, createMissionProgress, materializeFireMission, validateMissionPoints } from '../src/missions.js';
import { NEW_DISTRICTS, districtAt } from '../src/districts.js';
import { BUILDING_SITES, CROWDIE_HOUSE_GROUPS, CROWDIECITY_TOWERS, GANTON_HOMES } from '../src/city-plan.js';

test('Chief Panda has four single-fire calls in each new district', () => {
  const byDistrict = new Map();
  for (const mission of FIRE_MISSIONS) {
    assert.equal(mission.character_id, 'panda');
    assert.equal(mission.type, 'fire');
    assert.match(mission.dialogue.start[0].text, /^A fire started in the /);
    assert.equal(validateMissionPoints(mission), true, mission.id);
    const missions = byDistrict.get(mission.district) ?? [];
    missions.push(mission);
    byDistrict.set(mission.district, missions);
  }
  assert.equal(NEW_DISTRICTS.length, 8);
  for (const [district, missions] of byDistrict) {
    const expected = NEW_DISTRICTS.some(entry => entry.name === district) ? 4 : 3;
    assert.equal(missions.length, expected, `${district} has ${expected} fire calls`);
    assert.ok(missions.every(mission => mission.fireCandidates.length >= expected), `${district} has a building roster`);
    assert.ok(missions.every(mission => mission.fireCandidates.every(site => districtAt(site) === district)),
      `${district} only offers its own buildings`);
  }
  for (const district of NEW_DISTRICTS) assert.ok(byDistrict.has(district.name), district.name);
});

test('Chief Panda has four multiple-fire calls in each new district', () => {
  assert.equal(MULTI_FIRE_MISSIONS.length, 7 + NEW_DISTRICTS.length * 4);
  for (const mission of MULTI_FIRE_MISSIONS) {
    assert.equal(mission.character_id, 'panda');
    assert.match(mission.dialogue.start[0].text, /^Multiple fires started in the /);
    assert.ok(mission.fireCount >= 2 && mission.fireCount <= 3);
    assert.ok(mission.fireCandidates.length >= mission.fireCount);
    assert.equal(validateMissionPoints(mission), true, mission.id);
  }
  for (const district of NEW_DISTRICTS) {
    assert.equal(MULTI_FIRE_MISSIONS.filter(mission => mission.district === district.name).length, 4);
  }
});

test('Crowdie clusters, Crowdiecity towers, Ganton homes and delivery are placed in their districts', () => {
  assert.deepEqual(CROWDIE_HOUSE_GROUPS.map(group => group.length), [4,6,7]);
  for (const [x,z] of CROWDIE_HOUSE_GROUPS.flat()) assert.ok(BUILDING_SITES.some(site => site.pack === 'suburban' && site.x === x && site.z === z));
  for (const [x,z] of CROWDIECITY_TOWERS) assert.ok(BUILDING_SITES.some(site => site.x === x && site.z === z
    && site.pack === 'commercial' && site.name.startsWith('building-skyscraper-')));
  for (const [x,z] of GANTON_HOMES) assert.ok(BUILDING_SITES.some(site => site.x === x && site.z === z && site.pack === 'suburban'));
  assert.equal(districtAt(GANTON_DELIVERY_MISSION.target), 'Ganton');
  assert.equal(validateMissionPoints(GANTON_DELIVERY_MISSION), true);
  const delivery = createMissionProgress(GANTON_DELIVERY_MISSION);
  delivery.update(GANTON_DELIVERY_MISSION.target, false, 1.9);
  assert.equal(delivery.stage, 'going');
  delivery.update(GANTON_DELIVERY_MISSION.target, false, .1);
  assert.equal(delivery.stage, 'complete');
});

test('relocated mission labels and return points match their new neighborhoods', () => {
  for (const [id, district] of [
    ['hawk_03', 'Orchard Grove'], ['pigeon_03', 'Brickworks'],
    ['fox_03', 'Cedar Park'], ['bear_03', 'Skyline Court'],
    ['cheetah_03', 'Crowdie'],
  ]) {
    const mission = PLAYABLE_MISSIONS.find(entry => entry.id === id);
    assert.equal(districtAt(mission.target), district, id);
    assert.ok(mission.label.includes(district), id);
  }
});

test('fire calls select fresh unique buildings from their district rosters', () => {
  const random = () => .42;
  const multi = materializeFireMission(MULTI_FIRE_MISSIONS[0], random);
  assert.equal(multi.fireSites.length, multi.fireCount);
  assert.equal(new Set(multi.fireSites.map(site => site.worldBuildingId)).size, multi.fireCount);
  assert.equal(validateMissionPoints(multi), true);
  const citywide = materializeFireMission(CITYWIDE_FIRE_MISSION, random);
  assert.equal(citywide.title, 'FIRE FIRE FIRE FIRE AAHHHH!');
  assert.equal(citywide.fireSites.length, 10);
  assert.equal(new Set(citywide.fireSites.map(site => site.worldBuildingId)).size, 10);
  assert.equal(validateMissionPoints(citywide), true);
});

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
