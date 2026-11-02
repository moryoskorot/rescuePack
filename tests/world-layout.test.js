import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  AVENUE_X, AVENUE_SEGMENTS, STREET_Z, STREET_SEGMENTS, ROAD_CURVES, ROAD_ROUND_ENDS, ROAD_HALF_WIDTH, SIDEWALK_OUTER, ROAD_Y, PAVEMENT_Y, DECK_Y,
  DRIVEWAYS, HYDRANT_LOCATIONS, LOTS, LAND_BOUNDS, PIER_BOUNDS,
  GROUND_ZONES, createRoadSurfaceRects, groundZoneAt, insideRect, isRoad, isDriveway, isReserved,
  surfaceAt, getSurfaceHeight, footprintOnLandOrPier, vehicleFootprint,
  buildWorldSurfaces,
} from '../src/world-layout.js';

test('northern streets form branches and Ganton has a curved western loop', () => {
  const originalArea = (145 - -130) * (85 - -91);
  const currentArea = (LAND_BOUNDS.maxX - LAND_BOUNDS.minX) * (LAND_BOUNDS.maxZ - LAND_BOUNDS.minZ);
  assert.ok(currentArea >= originalArea * 3.7);
  assert.ok(LAND_BOUNDS.minZ < -580);
  assert.equal(surfaceAt(-90, -542), 'road');
  assert.equal(surfaceAt(-18, -510), 'road');
  assert.equal(surfaceAt(-112,-490),'road');
  assert.equal(surfaceAt(-90,-440),'road');
  assert.equal(surfaceAt(-102-Math.SQRT1_2*10,-532-Math.SQRT1_2*10),'road');
  assert.equal(surfaceAt(-102-Math.SQRT1_2*10,-450+Math.SQRT1_2*10),'road');
  assert.equal(surfaceAt(-122,-542),'grass','outside of the rounded corner remains lawn');
  assert.equal(surfaceAt(-90, -510), 'grass');
  assert.equal(surfaceAt(-90, -576), 'grass');
  assert.equal(isRoad(85, -440), false, 'Skyline Court is not cut into grid squares');
  assert.equal(surfaceAt(105, -525), 'market');
});

test('hardscape follows district character while parks and residential areas keep grass', () => {
  assert.ok(GROUND_ZONES.some(zone => zone.name === 'Crowdiecity' && zone.kind === 'urban'));
  assert.equal(surfaceAt(86, -304), 'urban', 'Crowdiecity uses warm grey paving');
  assert.equal(surfaceAt(105, -389), 'industrial', 'Brickworks uses yard concrete');
  assert.equal(surfaceAt(86, -440), 'urban', 'Skyline Court is a paved tower district');
  assert.equal(surfaceAt(0, -15), 'civic', 'Town Hall has its own civic forecourt');
  assert.equal(surfaceAt(76, -12), 'industrial', 'the industrial yards are not lawn');
  assert.equal(surfaceAt(-72, -304), 'grass', 'Crowdie remains a planted residential neighborhood');
  assert.equal(surfaceAt(-84, -463), 'grass', 'Cedar Park remains green');
  assert.equal(surfaceAt(18, -304), 'road', 'hardscape never replaces the street network');
  assert.equal(surfaceAt(13, -304), 'pavement', 'hardscape never replaces sidewalks');
  assert.equal(groundZoneAt(0, -15)?.name, 'Town Hall Plaza');
});

test('street ends meet another street, curved bend or rounded turnaround', () => {
  const curveTangent=(x,z)=>ROAD_CURVES.some(curve => [curve.start,curve.end].some(angle =>
    Math.hypot(x-curve.x-Math.cos(angle)*curve.radius,z-curve.z-Math.sin(angle)*curve.radius)<1e-8));
  for (const avenue of AVENUE_SEGMENTS) for (const z of [avenue.minZ, avenue.maxZ]) {
    assert.ok(STREET_SEGMENTS.some(street => street.z === z && avenue.x >= street.minX && avenue.x <= street.maxX)
      || curveTangent(avenue.x,z),
      `avenue ${avenue.x} ends at ${z} without a junction`);
  }
  for (const street of STREET_SEGMENTS) for (const x of [street.minX, street.maxX]) {
    assert.ok(AVENUE_SEGMENTS.some(avenue => avenue.x === x && street.z >= avenue.minZ && street.z <= avenue.maxZ)
      || curveTangent(x,street.z)
      || ROAD_ROUND_ENDS.some(end => end.x === x && end.z === street.z),
    `street ${street.z} ends at ${x} without a junction or turnaround`);
  }
});

test('curved roads and round ends use exact shared collision and rendering geometry', () => {
  const palette=Object.fromEntries(['grass','asphalt','pavement','line','wood','stone','urbanGround','civicGround','industrialGround','marketGround'].map(name=>[name,new THREE.MeshStandardMaterial()]));
  const group=buildWorldSurfaces(THREE,palette);
  assert.equal(ROAD_CURVES.length,11, 'every endpoint-to-endpoint turn is a tangent curve');
  assert.equal(ROAD_ROUND_ENDS.length,2);
  assert.ok(group.children.some(child=>child.geometry?.type==='BufferGeometry' && child.geometry.getAttribute('position')?.count===66));
  assert.ok(group.children.some(child=>child.geometry?.type==='CircleGeometry' && child.geometry.parameters.radius===8));
  assert.equal(surfaceAt(112,-542),'road');
  assert.equal(surfaceAt(114.5,-542),'pavement');
  assert.equal(surfaceAt(115,-542),'market');
});

test('road and sidewalk faces form a disjoint partition, including every intersection', () => {
  const rectangles = createRoadSurfaceRects();
  const inCurve = (x, z, halfWidth = ROAD_HALF_WIDTH) => ROAD_CURVES.some(curve => {
    const angle = Math.atan2(z - curve.z, x - curve.x);
    const normalized = angle < 0 ? angle + Math.PI * 2 : angle;
    return normalized >= curve.start && normalized <= curve.end
      && Math.abs(Math.hypot(x - curve.x, z - curve.z) - curve.radius) <= halfWidth;
  });
  for (let i = 0; i < rectangles.length; i++) for (let j = i + 1; j < rectangles.length; j++) {
    const a = rectangles[i], b = rectangles[j];
    const width = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
    const depth = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
    assert.ok(width <= 1e-9 || depth <= 1e-9, `surfaces overlap: ${JSON.stringify(a)} and ${JSON.stringify(b)}`);
  }
  for (const x of AVENUE_X) for (const z of STREET_Z) {
    if (z < -430) continue; // northern bends are exact meshes, not rectangles
    const point = {x:x+.013,z:z+.017};
    if (inCurve(point.x, point.z)) continue; // an elbow is an exact arc mesh
    const roadFaces = rectangles.filter(rect => rect.kind === 'road' && insideRect(point.x, point.z, rect));
    assert.equal(roadFaces.length, Number(isRoad(point.x,point.z)), `junction ${x},${z} has the correct asphalt face`);
  }
  for (const [x, z] of [[-84, 5], [-18, 55], [85, 38], [-100, 5], [85, 50]]) {
    assert.equal(isRoad(x, z), false, `local street ends before ${x},${z}`);
  }
  // Sample away from cell boundaries, checking both lane continuity and walkways.
  for (let x = -121.73; x < 122; x += 1.47) for (let z = -81.71; z < 76; z += 1.31) {
    const matches = rectangles.filter(rect => insideRect(x, z, rect));
    assert.ok(matches.length <= 1);
    if (isRoad(x, z) && !inCurve(x, z)) assert.equal(matches[0]?.kind, 'road', `missing asphalt at ${x},${z}`);
    if (isReserved(x, z) && !inCurve(x, z, SIDEWALK_OUTER)) assert.equal(matches.length, 1, `reserved surface missing at ${x},${z}`);
  }
});

test('hydrant footprints stay on sidewalks and outside roads and the station driveway', () => {
  assert.ok(HYDRANT_LOCATIONS.length >= 35, 'hydrants cover the enlarged town');
  assert.ok(HYDRANT_LOCATIONS.filter(hydrant => hydrant.z < -100).length >= 12, 'northern districts have hydrants');
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
  assert.equal(footprintOnLandOrPier({ x: LAND_BOUNDS.maxX - 2.1, z: 20, heading: Math.PI / 2 }), false, 'nose crosses eastern boundary');
  assert.equal(footprintOnLandOrPier({ x: 0, z: LAND_BOUNDS.minZ + 2, heading: 0 }), false, 'rear crosses northern boundary');
});

test('diagonal entry cannot cut over water even when all four corners are on land or pier', () => {
  const pose = { x: 4.5, z: 83, heading: Math.PI / 4 };
  const dimensions = { halfWidth: 1, front: 4, rear: 4, margin: 0 };
  const corners = vehicleFootprint(pose, dimensions);
  assert.ok(corners.every(p => insideRect(p.x, p.z, LAND_BOUNDS) || insideRect(p.x, p.z, PIER_BOUNDS)));
  assert.equal(footprintOnLandOrPier(pose, dimensions), false);
});

test('renderer and vehicle share the same surface elevations', () => {
  const palette = Object.fromEntries(['grass', 'asphalt', 'pavement', 'line', 'wood', 'stone', 'urbanGround', 'civicGround', 'industrialGround', 'marketGround'].map(name => [name, new THREE.MeshStandardMaterial()]));
  const group = buildWorldSurfaces(THREE, palette);
  assert.ok(group.children.length > 0);
  assert.equal(getSurfaceHeight(18, 38), ROAD_Y);
  assert.equal(getSurfaceHeight(25.4, 32.575), PAVEMENT_Y);
  assert.equal(getSurfaceHeight(35, 31), ROAD_Y);
  assert.equal(getSurfaceHeight(12, 90), DECK_Y);
  assert.equal(getSurfaceHeight(86, -304), getSurfaceHeight(-72, -304));
  assert.equal(surfaceAt(0, 84.99), 'sand');
  assert.equal(surfaceAt(0, 85.01), 'water');
  assert.ok(getSurfaceHeight(0, 85.01) < getSurfaceHeight(0, 84.99));
  const ocean = group.getObjectByName('Ocean beyond the shore');
  assert.equal(ocean.position.z - ocean.geometry.parameters.height / 2, LAND_BOUNDS.maxZ);
});
