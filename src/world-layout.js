// Shared city plan. All positions are in metres; the truck's local front is +Z.
export const AVENUE_X = Object.freeze([-112, -84, -51, -18, 18, 52, 85, 113]);
export const STREET_Z = Object.freeze([-62, -30, 5, 38, 70]);
export const ROAD_HALF_WIDTH = 4.6;
export const SIDEWALK_OUTER = 6.25;
export const ROAD_Y = .12;
export const PAVEMENT_Y = .19;
export const GROUND_Y = -.08;
export const DECK_Y = .29;
export const LAND_BOUNDS = Object.freeze({ minX: -130, maxX: 130, minZ: -91, maxZ: 85 });
export const PIER_BOUNDS = Object.freeze({ minX: 6, maxX: 18, minZ: 79.5, maxZ: 104.5 });
export const BOARDWALK_BOUNDS = Object.freeze({ minX: -115, maxX: 115, minZ: 76, maxZ: 82 });
const ROAD_BOUNDS = { minX: -122, maxX: 122, minZ: -82, maxZ: 74 };
export const DRIVEWAYS = Object.freeze([
  // The station apron meets the near curb and never covers the street itself.
  { name: 'fire-station', minX: 27, maxX: 43, minZ: 27.3, maxZ: 33.4 },
]);

export function insideRect(x, z, rect, padding = 0) {
  return x >= rect.minX - padding && x <= rect.maxX + padding && z >= rect.minZ - padding && z <= rect.maxZ + padding;
}

function inRoadNetwork(x, z, halfWidth) {
  return AVENUE_X.some(center => Math.abs(x - center) <= halfWidth && z >= ROAD_BOUNDS.minZ && z <= ROAD_BOUNDS.maxZ)
    || STREET_Z.some(center => Math.abs(z - center) <= halfWidth && x >= ROAD_BOUNDS.minX && x <= ROAD_BOUNDS.maxX);
}

export function isRoad(x, z, padding = 0) {
  return inRoadNetwork(x, z, ROAD_HALF_WIDTH + padding);
}

export function isDriveway(x, z, padding = 0) {
  return DRIVEWAYS.some(rect => insideRect(x, z, rect, padding));
}

export function isReserved(x, z, padding = 0) {
  return inRoadNetwork(x, z, SIDEWALK_OUTER + padding) || isDriveway(x, z, padding);
}

export function surfaceAt(x, z) {
  if (insideRect(x, z, PIER_BOUNDS) || insideRect(x, z, BOARDWALK_BOUNDS)) return 'deck';
  if (!insideRect(x, z, LAND_BOUNDS)) return 'water';
  if (isRoad(x, z)) return 'road';
  if (isDriveway(x, z)) return 'driveway';
  if (inRoadNetwork(x, z, SIDEWALK_OUTER)) return 'pavement';
  if (z >= 82) return 'sand';
  return 'grass';
}

export function getSurfaceHeight(x, z) {
  return { road: ROAD_Y, driveway: ROAD_Y, pavement: PAVEMENT_Y, deck: DECK_Y, sand: -.055, grass: GROUND_Y, water: -.35 }[surfaceAt(x, z)];
}

// Rectangles partition the union of every road and sidewalk. Intersections are
// part of this partition, so there is exactly one visible surface at any point.
export function createRoadSurfaceRects() {
  const xCuts = new Set([ROAD_BOUNDS.minX, ROAD_BOUNDS.maxX]);
  const zCuts = new Set([ROAD_BOUNDS.minZ, ROAD_BOUNDS.maxZ]);
  for (const x of AVENUE_X) for (const offset of [-SIDEWALK_OUTER, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH, SIDEWALK_OUTER]) xCuts.add(x + offset);
  for (const z of STREET_Z) for (const offset of [-SIDEWALK_OUTER, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH, SIDEWALK_OUTER]) zCuts.add(z + offset);
  for (const rect of DRIVEWAYS) {
    xCuts.add(rect.minX); xCuts.add(rect.maxX); zCuts.add(rect.minZ); zCuts.add(rect.maxZ);
  }
  const xs = [...xCuts].sort((a, b) => a - b), zs = [...zCuts].sort((a, b) => a - b);
  const rectangles = [], active = new Map();
  for (let iz = 0; iz < zs.length - 1; iz++) {
    const row = [];
    for (let ix = 0; ix < xs.length - 1; ix++) {
      const x = (xs[ix] + xs[ix + 1]) / 2, z = (zs[iz] + zs[iz + 1]) / 2;
      const kind = isRoad(x, z) ? 'road' : isDriveway(x, z) ? 'driveway' : inRoadNetwork(x, z, SIDEWALK_OUTER) ? 'pavement' : null;
      if (!kind) continue;
      const previous = row[row.length - 1];
      if (previous?.kind === kind && previous.maxX === xs[ix]) previous.maxX = xs[ix + 1];
      else row.push({ minX: xs[ix], maxX: xs[ix + 1], minZ: zs[iz], maxZ: zs[iz + 1], kind });
    }
    const next = new Map();
    for (const rect of row) {
      const key = `${rect.kind}:${rect.minX}:${rect.maxX}`;
      const previous = active.get(key);
      if (previous && previous.maxZ === rect.minZ) { previous.maxZ = rect.maxZ; next.set(key, previous); }
      else { rectangles.push(rect); next.set(key, rect); }
    }
    active.clear();
    for (const [key, value] of next) active.set(key, value);
  }
  return rectangles;
}

export const LOTS = Object.freeze(AVENUE_X.slice(0, -1).flatMap((left, column) => STREET_Z.slice(0, -1).map((north, row) => ({
  id: `${column}-${row}`, column, row,
  minX: left + SIDEWALK_OUTER + .5,
  maxX: AVENUE_X[column + 1] - SIDEWALK_OUTER - .5,
  minZ: north + SIDEWALK_OUTER + .5,
  maxZ: STREET_Z[row + 1] - SIDEWALK_OUTER - .5,
}))));

// The full hydrant, including side caps, fits within the 1.65m sidewalk.
// Main's original hydrant should use scale .65 (its original radius is .93m).
export const HYDRANT_LOCATIONS = Object.freeze([
  { name: 'Fire station', x: 25.4, z: 32.575 },
  { name: 'School', x: -73, z: 32.575 },
  { name: 'Hospital', x: -73, z: 64.575 },
  { name: 'Town hall', x: 8.5, z: -.425 },
  { name: 'Museum', x: 42.5, z: -35.425 },
  { name: 'Town square', x: -8.5, z: 43.425 },
  { name: 'Suburban north', x: -98, z: -24.575 },
  { name: 'Suburban gardens', x: -68, z: -56.575 },
  { name: 'Suburban south', x: -98, z: 64.575 },
  { name: 'Downtown north', x: -34, z: -56.575 },
  { name: 'Downtown south', x: -34, z: 64.575 },
  { name: 'West factory', x: 61, z: -24.575 },
  { name: 'East factory', x: 100, z: -56.575 },
  { name: 'Industrial yards', x: 76, z: 10.425 },
  { name: 'Workers cottages', x: 103, z: 64.575 },
].map(location => Object.freeze({ ...location, radius: .62, scale: .65 })));

export function vehicleFootprint({ x, z, heading }, { halfWidth = 1.32, front = 2.85, rear = 2.85, margin = .06 } = {}) {
  const fx = Math.sin(heading), fz = Math.cos(heading), rx = Math.cos(heading), rz = -Math.sin(heading);
  return [[-halfWidth - margin, front + margin], [halfWidth + margin, front + margin], [halfWidth + margin, -rear - margin], [-halfWidth - margin, -rear - margin]].map(([side, forward]) => ({
    x: x + rx * side + fx * forward, z: z + rz * side + fz * forward,
  }));
}

export function footprintOnLandOrPier(pose, dimensions) {
  const corners = vehicleFootprint(pose, dimensions);
  if (corners.some(p => p.x < LAND_BOUNDS.minX || p.x > LAND_BOUNDS.maxX || p.z < LAND_BOUNDS.minZ || p.z > PIER_BOUNDS.maxZ)) return false;
  // Clip the convex vehicle footprint to the ocean side of the shore. Checking
  // just the four corners misses diagonal edges cutting across the pier entry.
  const wet = [];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i], b = corners[(i + 1) % corners.length];
    if (a.z > LAND_BOUNDS.maxZ) wet.push(a);
    if ((a.z > LAND_BOUNDS.maxZ) !== (b.z > LAND_BOUNDS.maxZ)) {
      const t = (LAND_BOUNDS.maxZ - a.z) / (b.z - a.z);
      wet.push({ x: a.x + (b.x - a.x) * t, z: LAND_BOUNDS.maxZ });
    }
  }
  return wet.every(p => p.x >= PIER_BOUNDS.minX && p.x <= PIER_BOUNDS.maxX && p.z <= PIER_BOUNDS.maxZ);
}

export const SHORE_BARRIERS = Object.freeze([
  { x: (-130 + 6) / 2, z: 85, w: 136, d: .25 },
  { x: (18 + 130) / 2, z: 85, w: 112, d: .25 },
  { x: 6, z: 94.75, w: .25, d: 19.5 },
  { x: 18, z: 94.75, w: .25, d: 19.5 },
  { x: 12, z: 104.5, w: 12, d: .25 },
]);

export function buildWorldSurfaces(THREE, materials) {
  const root = new THREE.Group(); root.name = 'City ground, streets and harbor';
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: .95 });
  const waterMaterial = new THREE.MeshBasicMaterial({ color: '#43adc7', toneMapped: false });
  const sandMaterial = material('#e5d7a5');
  function plane(rect, y, mat) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(rect.maxX - rect.minX, rect.maxZ - rect.minZ), mat);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set((rect.minX + rect.maxX) / 2, y, (rect.minZ + rect.maxZ) / 2);
    mesh.receiveShadow = true; root.add(mesh); return mesh;
  }
  function box(w, h, d, mat, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); mesh.receiveShadow = true; mesh.castShadow = h > .4; root.add(mesh); return mesh;
  }
  plane({ ...LAND_BOUNDS, maxZ: 82 }, GROUND_Y, materials.grass);
  plane({ ...LAND_BOUNDS, minZ: 82 }, -.055, sandMaterial);
  const water = plane({ minX: -400, maxX: 400, minZ: 85, maxZ: 440 }, -.35, waterMaterial);
  water.name = 'Ocean beyond the shore';
  for (const rect of createRoadSurfaceRects()) plane(rect, rect.kind === 'pavement' ? PAVEMENT_Y : ROAD_Y, rect.kind === 'road' ? materials.asphalt : materials.pavement);

  const markingMaterial = materials.line.clone();
  markingMaterial.polygonOffset = true; markingMaterial.polygonOffsetFactor = -1; markingMaterial.polygonOffsetUnits = -2;
  const mark = (x, z, w, d) => plane({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 }, ROAD_Y + .012, markingMaterial);
  for (const x of AVENUE_X) for (let z = -78; z < 71; z += 8) {
    if (STREET_Z.every(crossing => Math.abs(crossing - z) > 8.6)) mark(x, z, .16, 3);
  }
  for (const z of STREET_Z) for (let x = -118; x < 120; x += 8) {
    if (AVENUE_X.every(crossing => Math.abs(crossing - x) > 8.6)) mark(x, z, 3, .16);
  }
  for (const x of AVENUE_X) for (const z of STREET_Z) for (let stripe = -3; stripe <= 3; stripe++) {
    for (const side of [-1, 1]) {
      if (z + side * 6.1 + .7 <= ROAD_BOUNDS.maxZ) mark(x + stripe * 1.15, z + side * 6.1, .7, 1.4);
      mark(x + side * 6.1, z + stripe * 1.15, 1.4, .7);
    }
  }
  // Disjoint deck rectangles: the pier starts where the boardwalk ends.
  const deckRects = [BOARDWALK_BOUNDS, { ...PIER_BOUNDS, minZ: BOARDWALK_BOUNDS.maxZ }];
  for (const rect of deckRects) box(rect.maxX - rect.minX, .22, rect.maxZ - rect.minZ, materials.wood, (rect.minX + rect.maxX) / 2, DECK_Y - .11, (rect.minZ + rect.maxZ) / 2);
  for (let x = -112; x <= 112; x += 2.4) box(.06, .008, 6, materials.stone, x, DECK_Y + .008, 79);
  for (let z = 83; z < 104; z += 2.2) box(12, .008, .06, materials.stone, 12, DECK_Y + .008, z);
  for (const barrier of SHORE_BARRIERS) {
    const deck = barrier.z > 85, base = deck ? DECK_Y : -.055;
    box(barrier.w, .13, barrier.d, materials.wood, barrier.x, base + 1.1, barrier.z);
    const length = Math.max(barrier.w, barrier.d), count = Math.ceil(length / 6);
    for (let i = 0; i <= count; i++) {
      const offset = (i / count - .5) * length;
      box(.25, 1.35, .25, materials.wood, barrier.x + (barrier.w > barrier.d ? offset : 0), base + .6, barrier.z + (barrier.d > barrier.w ? offset : 0));
    }
  }
  root.userData.waterMaterial = waterMaterial;
  return root;
}
