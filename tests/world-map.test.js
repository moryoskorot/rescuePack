import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDING_SITES } from '../src/city-plan.js';
import { NEW_DISTRICTS } from '../src/districts.js';
import { LAND_BOUNDS, PIER_BOUNDS, ROAD_CURVES, ROAD_ROUND_ENDS, createRoadSurfaceRects } from '../src/world-layout.js';
import { mapFrame, worldMapFeatures, worldToMap } from '../src/world-map.js';

test('the city map reads the world roads, buildings and districts', () => {
  const features = worldMapFeatures();
  assert.deepEqual(features.roads, createRoadSurfaceRects());
  assert.equal(features.roadCurves,ROAD_CURVES);
  assert.equal(features.roadRoundEnds,ROAD_ROUND_ENDS);
  assert.equal(features.buildings, BUILDING_SITES);
  assert.ok(features.parks.some(park => park.name === 'Cedar Green'));
  assert.equal(features.bounds.minZ, LAND_BOUNDS.minZ);
  assert.equal(features.bounds.maxZ, PIER_BOUNDS.maxZ);
  for (const district of NEW_DISTRICTS) {
    assert.ok(features.districts.some(label => label.name === district.name
      && label.x === district.center[0] && label.z === district.center[1]), district.name);
  }
});

test('map projection keeps north at the top and fits the entire city', () => {
  const bounds = worldMapFeatures().bounds;
  const frame = mapFrame(bounds, 500, 700);
  const northwest = worldToMap({ x: bounds.minX, z: bounds.minZ }, bounds, frame);
  const southeast = worldToMap({ x: bounds.maxX, z: bounds.maxZ }, bounds, frame);
  assert.ok(northwest.x >= 18 && northwest.y >= 18);
  assert.ok(southeast.x <= 482 && southeast.y <= 682);
  assert.ok(northwest.x < southeast.x && northwest.y < southeast.y);
});
