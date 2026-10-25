import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  AVENUE_X, STREET_Z, ROAD_Y, PAVEMENT_Y, DECK_Y,
  DRIVEWAYS, HYDRANT_LOCATIONS, LOTS, LAND_BOUNDS, PIER_BOUNDS,
  createRoadSurfaceRects, insideRect, isRoad, isDriveway, isReserved,
  surfaceAt, getSurfaceHeight, footprintOnLandOrPier, vehicleFootprint,
  buildWorldSurfaces,
} from '../src/world-layout.js';

test('road and sidewalk faces form a disjoint partition, including every intersection', () => {
  const rectangles = createRoadSurfaceRects();
  for (let i = 0; i < rectangles.length; i++) for (let j = i + 1; j < rectangles.length; j++) {
    const a = rectangles[i], b = rectangles[j];
    const width = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
    const depth = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
    assert.ok(width <= 1e-9 || depth <= 1e-9, `surfaces overlap: ${JSON.stringify(a)} and ${JSON.stringify(b)}`);
  }
  for (const x of AVENUE_X) for (const z of STREET_Z) {
    const roadFaces = rectangles.filter(rect => rect.kind === 'road' && insideRect(x, z, rect));
    assert.equal(roadFaces.length, 1, `intersection ${x},${z} has one asphalt face`);
  }
  // Sample away from cell boundaries, checking both lane continuity and walkways.
  for (let x = -121.73; x < 122; x += 1.47) for (let z = -81.71; z < 76; z += 1.31) {
    const matches = rectangles.filter(rect => insideRect(x, z, rect));
    assert.ok(matches.length <= 1);
    if (isRoad(x, z)) assert.equal(matches[0]?.kind, 'road', `missing asphalt at ${x},${z}`);
    if (isReserved(x, z)) assert.equal(matches.length, 1, `reserved surface missing at ${x},${z}`);
  }
});

test('hydrant footprints stay on sidewalks and outside roads and the station driveway', () => {
  for (const hydrant of HYDRANT_LOCATIONS) {
    assert.equal(surfaceAt(hydrant.x, hydrant.z), 'pavement', hydrant.name);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
      const x = hydrant.x + Math.cos(angle) * hydrant.radius;
      const z = hydrant.z + Math.sin(angle) * hydrant.radius;
      assert.equal(surfaceAt(x, z), 'pavement', `${hydrant.name} has a cap outside the sidewalk`);
      assert.equal(isRoad(x, z), false);
      assert.equal(isDriveway(x, z), false);
    }
  }
  assert.ok(HYDRANT_LOCATIONS.some(h => h.name === 'Fire station'));
  assert.ok(HYDRANT_LOCATIONS.some(h => h.name === 'School'));
  assert.ok(HYDRANT_LOCATIONS.some(h => h.name === 'Hospital'));
  assert.ok(HYDRANT_LOCATIONS.some(h => h.name === 'Town hall'));
  assert.ok(HYDRANT_LOCATIONS.some(h => h.name === 'Museum'));
});

test('building lots reserve every road and sidewalk, with a half metre setback', () => {
  for (const lot of LOTS) {
    assert.ok(lot.maxX > lot.minX && lot.maxZ > lot.minZ);
    for (const x of [lot.minX, lot.maxX]) for (const z of [lot.minZ, lot.maxZ]) assert.equal(isReserved(x, z), false, lot.id);
  }
  const stationApron = DRIVEWAYS.find(rect => rect.name === 'fire-station');
  assert.equal(isRoad((stationApron.minX + stationApron.maxX) / 2, stationApron.minZ), false);
  assert.ok(Math.abs(stationApron.maxZ - (38 - 4.6)) < 1e-9);
});

test('full vehicle footprint stops at the shore and stays within the pier rails', () => {
  assert.equal(footprintOnLandOrPier({ x: 0, z: 80, heading: 0 }), true);
  assert.equal(footprintOnLandOrPier({ x: 0, z: 83, heading: 0 }), false, 'nose crosses water while center remains on land');
  assert.equal(footprintOnLandOrPier({ x: 12, z: 88, heading: 0 }), true, 'pier entrance stays open');
  assert.equal(footprintOnLandOrPier({ x: 12, z: 100, heading: Math.PI / 2 }), true);
  assert.equal(footprintOnLandOrPier({ x: 12, z: 103, heading: 0 }), false, 'nose crosses pier end');
  assert.equal(footprintOnLandOrPier({ x: 7, z: 95, heading: 0 }), false, 'left tires cross pier edge');
  assert.equal(footprintOnLandOrPier({ x: 127.9, z: 20, heading: Math.PI / 2 }), false, 'nose crosses eastern boundary');
  assert.equal(footprintOnLandOrPier({ x: 0, z: -89, heading: 0 }), false, 'rear crosses northern boundary');
});

test('diagonal entry cannot cut over water even when all four corners are on land or pier', () => {
  const pose = { x: 4.5, z: 83, heading: Math.PI / 4 };
  const dimensions = { halfWidth: 1, front: 4, rear: 4, margin: 0 };
  const corners = vehicleFootprint(pose, dimensions);
  assert.ok(corners.every(p => insideRect(p.x, p.z, LAND_BOUNDS) || insideRect(p.x, p.z, PIER_BOUNDS)));
  assert.equal(footprintOnLandOrPier(pose, dimensions), false);
});

test('renderer and vehicle share the same surface elevations', () => {
  const palette = Object.fromEntries(['grass', 'asphalt', 'pavement', 'line', 'wood', 'stone'].map(name => [name, new THREE.MeshStandardMaterial()]));
  const group = buildWorldSurfaces(THREE, palette);
  assert.ok(group.children.length > 0);
  assert.equal(getSurfaceHeight(18, 38), ROAD_Y);
  assert.equal(getSurfaceHeight(25.4, 32.575), PAVEMENT_Y);
  assert.equal(getSurfaceHeight(35, 31), ROAD_Y);
  assert.equal(getSurfaceHeight(12, 90), DECK_Y);
  assert.equal(surfaceAt(0, 84.99), 'sand');
  assert.equal(surfaceAt(0, 85.01), 'water');
  assert.ok(getSurfaceHeight(0, 85.01) < getSurfaceHeight(0, 84.99));
  const ocean = group.getObjectByName('Ocean beyond the shore');
  assert.equal(ocean.position.z - ocean.geometry.parameters.height / 2, LAND_BOUNDS.maxZ);
});
