import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILDING_SITES } from '../src/city-plan.js';
import { GANTON_DELIVERY_MISSION, PLAYABLE_MISSIONS } from '../src/missions.js';
import { createRoadNavigation, findRoadRoute, navigationObjectives } from '../src/road-navigation.js';
import { isRoad } from '../src/world-layout.js';

const station = { x: 35, z: 38 };
const ganton = GANTON_DELIVERY_MISSION.target;
const objective = (x, z, id = 'destination', color = 'blue') => ({ x, z, id, color });

test('every mission point and fire building can be approached on the road network', () => {
  const destinations = [
    ganton,
    ...PLAYABLE_MISSIONS.flatMap(mission => [mission.target, ...(mission.pickups ?? []), ...(mission.route ?? [])]),
    ...BUILDING_SITES.filter(site => site.worldBuildingId),
  ];
  for (const goal of destinations) {
    const route = findRoadRoute(station, [goal]);
    assert.equal(route.objective, goal);
    assert.ok(isRoad(route.endpoint.x, route.endpoint.z));
    for (let s = .5; s < route.length; s += 4) {
      const { x, z } = route.pointAt(s);
      assert.ok(isRoad(x, z), `Route to ${goal.x}, ${goal.z} leaves asphalt at ${x}, ${z}`);
    }
  }
});

test('Ganton chevrons follow the circular centerline and point down the curve in both directions', () => {
  const start = { x: -112, z: -512 };
  const end = { x: -90, z: -542 };
  for (const [from, to, direction] of [[start, end, 1], [end, start, -1]]) {
    const markers = createRoadNavigation().update(from, [objective(to.x, to.z)], 0);
    const bend = markers.filter(({ x, z }) => x < -102 && z < -532);
    assert.ok(bend.length >= 3);
    for (const marker of bend) {
      const x = marker.x + 102, z = marker.z + 532;
      assert.ok(Math.abs(Math.hypot(x, z) - 10) < 1e-8);
      assert.ok(Math.abs(x * marker.dx + z * marker.dz) < 1e-8);
      assert.ok(marker.dx * direction > 0 && marker.dz * direction < 0);
    }
    assert.ok(bend.every((marker, index) => !index || marker.dx > bend[index - 1].dx));
  }
});

test('intersection guidance turns inside the asphalt and follows the outgoing street', () => {
  const route = findRoadRoute({ x: -5, z: 38 }, [objective(18, 19)]);
  const before = route.pointAt(18), turn = route.pointAt(22), after = route.pointAt(30);
  assert.equal(before.dx, 1);
  assert.ok(turn.dx > .3 && turn.dz < -.3);
  assert.equal(after.dz, -1);
  for (let s = 19; s < 27; s += .25) {
    const { x, z, dx, dz } = route.pointAt(s);
    for (const across of [-2.1, 2.1]) {
      for (const along of [-1.45, 1.45]) {
        assert.ok(isRoad(x + dz * across + dx * along, z - dx * across + dz * along));
      }
    }
  }
});

test('navigation chooses the closer road route and switches on pickup or fire updates', () => {
  const start = { x: -18, z: -490 };
  const nearbyAcrossBlocks = objective(52, -490, 'cross-town', 'red');
  const aheadOnRoad = objective(-18, -410, 'on-road', 'red');
  assert.equal(findRoadRoute(start, [nearbyAcrossBlocks, aheadOnRoad]).objective, aheadOnRoad);
  const fireSites = new Map([[nearbyAcrossBlocks.id, nearbyAcrossBlocks], [aheadOnRoad.id, aheadOnRoad]]);
  const active = new Set(fireSites.keys());
  const burning = new Map([[aheadOnRoad.id, 50], [nearbyAcrossBlocks.id, 50], ['spread', 30]]);
  const fire = { type: 'fire' }, progress = { stage: 'going' };
  const navigation = createRoadNavigation();
  const initial = navigation.update(start, navigationObjectives(fire, progress, active, burning, fireSites), 0);
  assert.ok(initial.length && initial.every(marker => marker.color === 'red' && marker.dz > 0));

  burning.delete(aheadOnRoad.id);
  const remaining = navigationObjectives(fire, progress, active, burning, fireSites);
  assert.deepEqual(remaining.map(goal => goal.id), [nearbyAcrossBlocks.id]);
  const redirected = navigation.update(start, remaining, 0);
  assert.ok(redirected.length && redirected.some(marker => marker.dx > 0));
  assert.deepEqual(navigation.update(start, navigationObjectives(null, null, active, burning, fireSites), 0), []);

  const collect = { id: 'pickup-test', type: 'collect', pickups: [aheadOnRoad, nearbyAcrossBlocks], target: station };
  const collecting = { stage: 'collecting', collected: new Set([0]) };
  assert.deepEqual(navigationObjectives(collect, collecting), [
    { ...nearbyAcrossBlocks, id: 'pickup-test:1', color: 'blue' },
  ]);
  assert.deepEqual(navigationObjectives(collect, { stage: 'returning' }), [
    { ...station, id: 'pickup-test:destination', color: 'blue' },
  ]);
  const race = { id: 'race-test', type: 'race', route: [start, station] };
  assert.deepEqual(navigationObjectives(race, { stage: 'racing', checkpoint: 1 }), [
    { ...station, id: 'race-test:1', color: 'blue' },
  ]);
});

test('a chevron fades after the truck passes it on a curve and stays hidden when backing up', () => {
  const start = { x: -112, z: -512 };
  const objectives = [objective(ganton.x, ganton.z)];
  const route = findRoadRoute(start, objectives);
  const navigation = createRoadNavigation();
  const markerAt = (s, dt) => navigation.update(route.pointAt(s), objectives, dt)
    .find(marker => marker.metre === 24);
  for (let s = 0; s <= 24; s++) markerAt(s, .05);
  assert.equal(markerAt(24.3, .05).opacity, 1);
  assert.equal(markerAt(26, .05).fading, true);
  assert.equal(markerAt(27, .2).opacity, .5);
  assert.equal(markerAt(28, .2), undefined);
  for (let s = 28; s >= 21; s--) assert.equal(markerAt(s, .05), undefined);
});

test('a missed intersection reroutes without marking the old turn as passed', () => {
  const navigation = createRoadNavigation();
  const goals = [objective(18, 12)];
  navigation.update({ x: -5, z: 38 }, goals, 0);
  for (let x = -4; x <= 21; x++) navigation.update({ x, z: 38 }, goals, .05);
  const pastJunction = navigation.update({ x: 24, z: 38 }, goals, .05);
  const outbound = pastJunction.find(marker => marker.z < 32);
  const bend = pastJunction.find(marker => marker.z < 38 && marker.dx > 0);
  assert.ok(outbound && !outbound.fading);
  assert.ok(bend && !bend.fading);
  let markers;
  for (let x = 25; x <= 34; x++) markers = navigation.update({ x, z: 38 }, goals, .05);
  const oldTurn = markers.find(marker => marker.x === bend.x && marker.z === bend.z && marker.dz === bend.dz);
  const replacement = markers.find(marker => marker.z === 38 && marker.dx < 0 && marker.x > 24);
  assert.ok(oldTurn?.fading && oldTurn.opacity > 0);
  assert.ok(markers.includes(outbound) && outbound.opacity === 1);
  assert.ok(replacement && replacement.opacity < 1);

  const settled = navigation.update({ x: 34, z: 38 }, goals, .4);
  assert.ok(settled.some(marker => marker.z === 38 && marker.dx < 0 && marker.x > 24));
  assert.ok(settled.every(marker => marker.opacity === 1 && !marker.fading));
});

test('chevrons behind the truck fade while it drives past the intersection along the curb', () => {
  const navigation = createRoadNavigation();
  const goals = [objective(51, 38)];
  navigation.update({ x: -5, z: 38 }, goals, 0);
  for (let x = -4; x <= 15; x++) {
    navigation.update({ x, z: 38 + Math.min(6.5, (x + 5) / 2) }, goals, .05);
  }
  const curb = { x: 20, z: 44.5 };
  const markers = navigation.update(curb, goals, .05);
  const behind = markers.find(marker => marker.x === 19 && marker.z === 38);
  assert.ok(behind?.fading);
  assert.ok(navigation.update({ ...curb, x: 21 }, goals, .2).some(marker => marker.x === 19 && marker.opacity === .5));
  assert.ok(navigation.update({ ...curb, x: 22 }, goals, .2).every(marker => marker.x > 19));
});

test('shared chevrons keep their positions and opacity when the objective changes', () => {
  const navigation = createRoadNavigation();
  const start = { x: -12, z: 38 };
  const before = navigation.update(start, [objective(40, 38, 'first')], 0);
  const shared = before.find(marker => marker.x === 12);
  const changed = navigation.update({ x: -4, z: 38 }, [objective(18, 5, 'second')], 0);

  assert.ok(changed.includes(shared));
  assert.equal(shared.opacity, 1);
  assert.ok(!shared.fading);
  assert.ok(changed.some(marker => marker.fading && marker.x > 20));
  assert.ok(changed.some(marker => !marker.fading && marker.z < 35 && marker.opacity === 0));

  const halfway = navigation.update({ x: -4, z: 38 }, [objective(18, 5, 'second')], .2);
  assert.equal(shared.opacity, 1);
  assert.ok(halfway.some(marker => marker.fading && marker.opacity === .5));
  assert.ok(halfway.some(marker => !marker.fading && marker.z < 35 && marker.opacity === .5));
});
