// Shared city plan. All positions are in metres; the truck's local front is +Z.
export const AVENUE_X = Object.freeze([-112, -84, -51, -18, 18, 52, 85, 125]);
export const STREET_Z = Object.freeze([-542, -508, -474, -440, -406, -372, -338, -270, -236, -202, -168, -134, -100, -62, -30, 5, 38, 70]);
// The old town keeps its connected streets. The northern neighborhoods use
// branching spines, short local streets and a cul-de-sac instead of a grid.
export const AVENUE_SEGMENTS = Object.freeze([
  {x:-112,minZ:-532,maxZ:-450},
  {x:-112,minZ:-236,maxZ:70}, {x:-84,minZ:-338,maxZ:-30},
  {x:-51,minZ:-406,maxZ:-338}, {x:-51,minZ:-236,maxZ:70},
  {x:-18,minZ:-542,maxZ:38},
  {x:18,minZ:-474,maxZ:70}, {x:52,minZ:-542,maxZ:70},
  {x:85,minZ:-406,maxZ:-338}, {x:85,minZ:-236,maxZ:5},
  {x:125,minZ:-338,maxZ:70},
].map(road => Object.freeze(road)));
export const STREET_SEGMENTS = Object.freeze([
  {z:-542,minX:-102,maxX:-18}, {z:-542,minX:52,maxX:105},
  {z:-508,minX:52,maxX:105},
  {z:-474,minX:-18,maxX:52}, {z:-440,minX:-102,maxX:52},
  {z:-406,minX:-51,maxX:85}, {z:-372,minX:-51,maxX:85},
  {z:-338,minX:-84,maxX:125}, {z:-270,minX:-84,maxX:125},
  ...STREET_Z.filter(z => z >= -236).map(z => ({z,minX:z===5?-51:-112,maxX:z===38?52:125})),
].map(road => Object.freeze(road)));
// Ganton's western road follows two real quarter-circle bends. The eastern
// Market Mile lanes finish in circular bulbs, never square asphalt pads.
export const ROAD_CURVES = Object.freeze([
  {x:-102,z:-532,radius:10,start:Math.PI,end:Math.PI*1.5},
  {x:-102,z:-450,radius:10,start:Math.PI*.5,end:Math.PI},
].map(curve => Object.freeze(curve)));
export const ROAD_ROUND_ENDS = Object.freeze([
  {x:105,z:-542,radius:8}, {x:105,z:-508,radius:8},
].map(end => Object.freeze(end)));
export const ROAD_HALF_WIDTH = 4.6;
export const SIDEWALK_OUTER = 6.25;
export const ROAD_Y = .12;
export const PAVEMENT_Y = .19;
export const GROUND_Y = -.08;
export const DECK_Y = .29;
// The northward extension gives the new neighborhoods room while preserving
// the original town and harbor street positions.
export const LAND_BOUNDS = Object.freeze({ minX: -130, maxX: 145, minZ: -590, maxZ: 85 });
export const PIER_BOUNDS = Object.freeze({ minX: 6, maxX: 18, minZ: 79.5, maxZ: 104.5 });
export const BOARDWALK_BOUNDS = Object.freeze({ minX: -115, maxX: 115, minZ: 76, maxZ: 82 });
const ROAD_BOUNDS = { minX: -122, maxX: 134, minZ: -589, maxZ: 74 };
export const DRIVEWAYS = Object.freeze([
  // The station apron meets the near curb and never covers the street itself.
  { name: 'fire-station', minX: 27, maxX: 43, minZ: 27.3, maxZ: 33.4 },
]);

export function insideRect(x, z, rect, padding = 0) {
  return x >= rect.minX - padding && x <= rect.maxX + padding && z >= rect.minZ - padding && z <= rect.maxZ + padding;
}

function inCurvedRoad(x, z, halfWidth) {
  return ROAD_CURVES.some(curve => {
    const angle = Math.atan2(z-curve.z,x-curve.x);
    const normalized = angle < 0 ? angle + Math.PI*2 : angle;
    return normalized >= curve.start && normalized <= curve.end
      && Math.abs(Math.hypot(x-curve.x,z-curve.z)-curve.radius) <= halfWidth;
  }) || ROAD_ROUND_ENDS.some(end => Math.hypot(x-end.x,z-end.z) <= end.radius + halfWidth - ROAD_HALF_WIDTH);
}

function inRoadNetwork(x, z, halfWidth, includeCurves = true) {
  return AVENUE_SEGMENTS.some(road => Math.abs(x - road.x) <= halfWidth && z >= road.minZ && z <= road.maxZ)
    || STREET_SEGMENTS.some(road => Math.abs(z - road.z) <= halfWidth && x >= road.minX && x <= road.maxX)
    || (includeCurves && inCurvedRoad(x,z,halfWidth));
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
  for (const road of AVENUE_SEGMENTS) {
    for (const offset of [-SIDEWALK_OUTER, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH, SIDEWALK_OUTER]) xCuts.add(road.x + offset);
    zCuts.add(road.minZ); zCuts.add(road.maxZ);
  }
  for (const road of STREET_SEGMENTS) {
    for (const offset of [-SIDEWALK_OUTER, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH, SIDEWALK_OUTER]) zCuts.add(road.z + offset);
    xCuts.add(road.minX); xCuts.add(road.maxX);
  }
  for (const rect of DRIVEWAYS) {
    xCuts.add(rect.minX); xCuts.add(rect.maxX); zCuts.add(rect.minZ); zCuts.add(rect.maxZ);
  }
  const xs = [...xCuts].sort((a, b) => a - b), zs = [...zCuts].sort((a, b) => a - b);
  const rectangles = [], active = new Map();
  for (let iz = 0; iz < zs.length - 1; iz++) {
    const row = [];
    for (let ix = 0; ix < xs.length - 1; ix++) {
      const x = (xs[ix] + xs[ix + 1]) / 2, z = (zs[iz] + zs[iz + 1]) / 2;
      const kind = inRoadNetwork(x,z,ROAD_HALF_WIDTH,false) ? 'road' : isDriveway(x, z) ? 'driveway' : inRoadNetwork(x, z, SIDEWALK_OUTER,false) ? 'pavement' : null;
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

// The old town has regular lots; northern blocks are shaped individually.
const ORIGINAL_STREET_Z = STREET_Z.filter(z => z >= -236);
export const LOTS = Object.freeze(AVENUE_X.slice(0, -1).flatMap((left, column) => ORIGINAL_STREET_Z.slice(0, -1).map((north, row) => ({
  id: `${column}-${row}`, column, row,
  minX: left + SIDEWALK_OUTER + .5,
  maxX: AVENUE_X[column + 1] - SIDEWALK_OUTER - .5,
  minZ: north + SIDEWALK_OUTER + .5,
  maxZ: ORIGINAL_STREET_Z[row + 1] - SIDEWALK_OUTER - .5,
}))));

// The full hydrant, including side caps, fits within the 1.65m sidewalk.
// Main's original hydrant should use scale .65 (its original radius is .93m).
const EXTRA_HYDRANT_ROWS = [
  [-542, [-90,-67,-35,0,35]], [-508, [68,105]],
  [-474, [0,35]], [-440, [0,35]],
  [-406, [-35,0,35,68]], [-372, [-35,0,35,68]],
  [-338, [-67,-35,0,35,68,105]], [-270, [-67,-35,0,35,68,105]],
  [-236, [-98, -35, 35, 105]],
  [-202, [-67, 0, 68]],
  [-168, [-98, 35, 105]],
  [-134, [-35, 68]],
  [-100, [-98, 0, 105]],
  [-62, [0, 68]],
  [-30, [-35, 105]],
  [5, [-35, 35]],
  [70, [0, 35]],
];
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
  ...EXTRA_HYDRANT_ROWS.flatMap(([roadZ, xs]) => xs.map(x => ({
    name: `Street ${roadZ}, ${x}`, x, z: roadZ + (roadZ === 70 ? -5.425 : 5.425),
  }))).filter(location => surfaceAt(location.x, location.z) === 'pavement'),
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
  { x: (18 + LAND_BOUNDS.maxX) / 2, z: 85, w: LAND_BOUNDS.maxX - 18, d: .25 },
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

  // Exact annular meshes keep the bends smooth at driving distance. Their
  // straight tangent pieces are supplied by the usual street rectangles.
  function arcBand(curve, inner, outer, y, mat) {
    const vertices = [], indices = [], steps = 32;
    for (let i=0;i<=steps;i++) {
      const angle=curve.start+(curve.end-curve.start)*i/steps;
      for (const radius of [inner,outer]) vertices.push(curve.x+Math.cos(angle)*radius,y,curve.z+Math.sin(angle)*radius);
      if (i<steps) { const n=i*2; indices.push(n,n+1,n+3,n,n+3,n+2); }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,mat.clone()); mesh.material.side=THREE.DoubleSide;
    mesh.receiveShadow=true; root.add(mesh);
  }
  for (const curve of ROAD_CURVES) {
    arcBand(curve,curve.radius-SIDEWALK_OUTER,curve.radius-ROAD_HALF_WIDTH,PAVEMENT_Y,materials.pavement);
    arcBand(curve,curve.radius+ROAD_HALF_WIDTH,curve.radius+SIDEWALK_OUTER,PAVEMENT_Y,materials.pavement);
    arcBand(curve,curve.radius-ROAD_HALF_WIDTH,curve.radius+ROAD_HALF_WIDTH,ROAD_Y,materials.asphalt);
  }
  for (const end of ROAD_ROUND_ENDS) {
    const ring=new THREE.Mesh(new THREE.RingGeometry(end.radius,end.radius+SIDEWALK_OUTER-ROAD_HALF_WIDTH,48),materials.pavement);
    ring.rotation.x=-Math.PI/2; ring.position.set(end.x,PAVEMENT_Y,end.z); ring.receiveShadow=true; root.add(ring);
    const asphalt=new THREE.Mesh(new THREE.CircleGeometry(end.radius,48),materials.asphalt);
    asphalt.rotation.x=-Math.PI/2; asphalt.position.set(end.x,ROAD_Y,end.z); asphalt.receiveShadow=true; root.add(asphalt);
  }

  const markingMaterial = materials.line.clone();
  markingMaterial.polygonOffset = true; markingMaterial.polygonOffsetFactor = -1; markingMaterial.polygonOffsetUnits = -2;
  const mark = (x, z, w, d) => plane({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 }, ROAD_Y + .012, markingMaterial);
  for (const curve of ROAD_CURVES) for (const [from,to] of [[.17,.35],[.61,.79]]) {
    const sweep=curve.end-curve.start;
    arcBand({...curve,start:curve.start+sweep*from,end:curve.start+sweep*to},
      curve.radius-.08,curve.radius+.08,ROAD_Y+.014,markingMaterial);
  }
  for (const road of AVENUE_SEGMENTS) for (let z = road.minZ + 4; z < road.maxZ - 3; z += 8) {
    if (STREET_SEGMENTS.every(crossing => z < crossing.z - 8.6 || z > crossing.z + 8.6 || road.x < crossing.minX || road.x > crossing.maxX)) mark(road.x, z, .16, 3);
  }
  for (const road of STREET_SEGMENTS) for (let x = road.minX + 4; x < road.maxX - 3; x += 8) {
    if (AVENUE_SEGMENTS.every(crossing => x < crossing.x - 8.6 || x > crossing.x + 8.6 || road.z < crossing.minZ || road.z > crossing.maxZ)) mark(x, road.z, 3, .16);
  }
  for (const x of AVENUE_X) for (const z of STREET_Z) if (
    AVENUE_SEGMENTS.some(road => road.x === x && z >= road.minZ && z <= road.maxZ)
    && STREET_SEGMENTS.some(road => road.z === z && x >= road.minX && x <= road.maxX)
  ) for (let stripe = -3; stripe <= 3; stripe++) {
    for (const side of [-1, 1]) {
      if (isRoad(x, z + side * 6.1)) mark(x + stripe * 1.15, z + side * 6.1, .7, 1.4);
      if (isRoad(x + side * 6.1, z)) mark(x + side * 6.1, z + stripe * 1.15, 1.4, .7);
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
