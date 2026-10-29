import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';
import { FIRETRUCK, VEHICLE_STEP, createVehicleState, vehicleMotion, wheelContacts } from './vehicle-physics.js';
import { AVENUE_X, HYDRANT_LOCATIONS, SHORE_BARRIERS, buildWorldSurfaces, getSurfaceHeight, surfaceAt, isReserved } from './world-layout.js';
import { BUILDING_SITES, CIVIC_ENVELOPES } from './city-plan.js';
import { BUILDING_TYPES_BY_PATH } from './building-catalog.js';
import WINDOW_MAP from './building-windows.json';
import { createBuildingFireState } from './building-fire.js';
import { createBuildingFireEffect } from './building-fire-effect.js';
import { INDUSTRIAL_CHIMNEYS } from './industrial-chimneys.js';
import { advanceVehicle } from './drive-world.js';
import { createTouchControls } from './touch-controls.js';
import { createWaterBoostState, stepWaterBoost } from './water-boost.js';
import { createWaterEffect } from './water-effect.js';
import { createVehicleSound } from './vehicle-sound.js';
import { createMissionSound } from './mission-sound.js';
import { createFirefightingProgress, nearestBurningBuilding, HOSE_RANGE } from './firefighting.js';
import { createFirefightingEffect } from './firefighting-effect.js';
import { firetruckNozzleWorld } from './firetruck-nozzle.js';
import { createHoseProjectiles } from './hose-projectiles.js';
import { worldWindowTargets } from './window-targets.js';
import { loadWaterTuning } from './water-tuning-config.js';
import { edgeMarkerLayout } from './fire-markers.js';
import { interpolateVehiclePose } from './render-pose.js';
import { createGroundMarkers } from './ground-markers.js';
import { PLAYABLE_MISSIONS, createMissionProgress } from './missions.js';
import { createMissionDeck } from './mission-deck.js';
import { dialogueBeats } from './mission-dialogue.js';
import { createMissionMarkers } from './mission-markers.js';

const canvas = document.querySelector('#world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;

const scene = new THREE.Scene();
const fireState = createBuildingFireState(BUILDING_SITES);
const fireProgress = createFirefightingProgress(fireState);
const fireSitesById = new Map(BUILDING_SITES.filter(site => site.worldBuildingId).map(site => [site.worldBuildingId, site]));
const fireTargets = new Map();
let groundMarkers, missionMarkers;
const fireEffect = createBuildingFireEffect(THREE, scene, fireState);
const hoseEffect = createFirefightingEffect(THREE, scene);
const waterTuning = loadWaterTuning();
const hoseImpacts = [];
const hose = createHoseProjectiles(THREE,(id,windowId,point,reduction)=>{
  if(fireState.onFire.has(id)){
    fireProgress.apply(id,reduction);
    hoseImpacts.push(point.clone());
    const window=fireTargets.get(id)?.find(target=>target.id===windowId);
    if(window)groundMarkers?.addWallImpact(point,window.normal);
  }
});
// Scenario scripts can ignite a placed building by its world ID. For a quick
// preview, open the game with ?fire=WB-001:75 (repeat `fire` for more sites).
const debugFires = new URLSearchParams(location.search).getAll('fire');
window.buildingFires = { onFire: fireState.onFire, set: fireState.set, sites: BUILDING_SITES };
function startFires() {
  fireProgress.clear();
  fireEffect.clear();
  groundMarkers?.clearImpacts();
  hose.reset();hoseEffect.reset();
  if (debugFires.length) {
    fireState.clear();
    for (const entry of debugFires) {
      const [id, percent] = entry.split(':');
      if (fireSitesById.has(id)) fireState.set(id, percent);
    }
  } else fireState.clear();
}
scene.background = new THREE.Color('#a8cfe3');
scene.fog = new THREE.Fog('#a8cfe3', 185, 420);
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, .5, 500);
const hemi = new THREE.HemisphereLight('#ffffff', '#8fa38b', 1.8);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0ce', 1.95);
sun.position.set(-65, 110, 55);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -135;
sun.shadow.camera.right = 135;
sun.shadow.camera.top = 135;
sun.shadow.camera.bottom = -135;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 300;
sun.shadow.bias = -.00005;
sun.shadow.normalBias = .04;
scene.add(sun);

const mat = (color, roughness = 1, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const M = {
  grass: mat('#a7cb80'), lawn: mat('#85bd71'), park: mat('#72ba78'), pavement: mat('#ebdfc3'), stone: mat('#d6c6a9'),
  asphalt: mat('#485e70'), line: mat('#fff2c9'), wall: mat('#fff1d5'), red: mat('#db4d40'), darkRed: mat('#ad342f'),
  blue: mat('#327bb0'), darkBlue: mat('#254b72'), glass: mat('#8fd3df', .18, .18), yellow: mat('#f6c44b'),
  wood: mat('#a86c49'), metal: mat('#697f86', .38, .55), leaves: mat('#5fa968'), flower: mat('#e95375'),
};
const worldSurfaces = buildWorldSurfaces(THREE, M);
scene.add(worldSurfaces);
groundMarkers = createGroundMarkers(THREE, scene, getSurfaceHeight);
missionMarkers = createMissionMarkers(THREE, scene, getSurfaceHeight);
const waterMaterial = worldSurfaces.userData.waterMaterial;
const avenueX = AVENUE_X;

function box(parent, w, h, d, material, x = 0, y = 0, z = 0, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function cylinder(parent, top, bottom, h, material, x, y, z, segments = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, h, segments), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function disc(parent, radius, material, x, y, z, segments = 32) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, segments), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function group(x, z) { const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g); return g; }
const solids = SHORE_BARRIERS.map(bounds => ({ ...bounds }));
function solid(x, z, w, d) { solids.push({ x, z, w, d }); }

const ASSETS = {
  commercial: ['building-a','building-b','building-c','building-d','building-e','building-f','building-g','building-h','building-i','building-j','building-k','building-l','building-m','building-n','building-skyscraper-a','building-skyscraper-b','building-skyscraper-d','building-skyscraper-e'],
  suburban: ['building-type-a','building-type-b','building-type-c','building-type-d','building-type-e','building-type-f','building-type-g','building-type-h','building-type-i','building-type-j','building-type-k','building-type-l','building-type-m','building-type-n','building-type-o','building-type-p','building-type-q','building-type-r','building-type-s','building-type-t','building-type-u','tree-large','tree-small','planter','fence-low'],
  industrial: ['building-a','building-b','building-c','building-d','building-e','building-f','building-g','building-h','building-i','building-j','building-k','building-l','building-m','building-n','building-o','building-p','building-q','building-r','building-s','building-t','chimney-large','chimney-medium','shipping-container-a','shipping-container-b','shipping-container-c','detail-tank','water-tower'],
  roads: ['light-curved','light-square','traffic-light','dumpster','road-sign-stop','construction-cone','electricity-pole'],
  cars: ['firetruck','sedan','taxi','suv','ambulance','delivery','van'],
};
const gltfLoader = new GLTFLoader();
const models = new Map();
const allAssets = Object.entries(ASSETS).flatMap(([pack, names]) => names.map(name => [pack, name]));
let loaded = 0;
async function preload() {
  await Promise.all(allAssets.map(async ([pack, name]) => {
    const url = `${import.meta.env.BASE_URL}assets/${pack}/${name}.glb`;
    const gltf = await gltfLoader.loadAsync(url);
    models.set(`${pack}/${name}`, gltf.scene);
    loaded++;
    document.querySelector('#loading-fill').style.width = `${Math.round(loaded / allAssets.length * 100)}%`;
    document.querySelector('#loading-copy').textContent = `${loaded} of ${allAssets.length} little city pieces ready`;
  }));
}
function model(pack, name, x, z, scale, rotation = 0, y = 0, parent = scene) {
  const source = models.get(`${pack}/${name}`);
  if (!source) return null;
  const item = source.clone(true);
  item.position.set(x, y, z);
  item.rotation.y = rotation;
  item.scale.setScalar(scale);
  item.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
  parent.add(item);
  return item;
}
let seed = 13;
function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function pick(items) { return items[Math.floor(random() * items.length)]; }

const landmarks = [];
function landmark(title, x, z, y, color = '#f35a46') { landmarks.push({ title, x, z, y, color }); }
function awning(parent, x, z, w, color = M.red) { box(parent, w, .25, 1.45, color, x, 3.4, z); }
function windows(parent, width, levels, startY, frontZ, spacing = 2.5) {
  for (let floor = 0; floor < levels; floor++) for (let x = -width / 2 + 1.6; x < width / 2 - .6; x += spacing) {
    box(parent, 1.25, 1.4, .08, M.glass, x, startY + floor * 2.2, frontZ, false);
    box(parent, 1.45, .13, .18, M.darkBlue, x, startY + floor * 2.2 - .75, frontZ + .07, false);
  }
}
function fireStation() {
  const x = 35, z = 21, g = group(x, z);
  box(g, 21, .45, 17, M.stone, 0, .22, -1.5);
  box(g, 19, 7.8, 15, M.wall, 0, 4.1, -1.5);
  box(g, 20, 1.35, 16, M.red, 0, 8.65, -1.5);
  box(g, 12.6, 5.5, .18, M.darkRed, -2.1, 2.98, 6.16);
  for (const xx of [-6.1, -.8, 4.5]) {
    box(g, 4.45, 4.5, .13, M.darkBlue, xx, 2.52, 6.3, false);
    for (let h = 0; h < 3; h++) box(g, 4, .45, .15, M.glass, xx, 1.6 + h * 1.15, 6.4, false);
  }
  box(g, 2.6, 5, 2.6, M.red, 8, 10.8, -5.5);
  box(g, 3.5, .7, 3.5, M.darkRed, 8, 13.6, -5.5);
  box(g, 18, 1.45, .35, M.red, 0, 7.3, 6.1);
  box(g, 2.1, 2.1, .1, M.wall, 8, 2.3, 6.28);
  box(g, 1.4, 1.4, .13, M.yellow, 8, 5.4, 6.33);
  box(g, .5, .85, .16, M.red, 8, 5.42, 6.42);
  box(g, .9, .5, .16, M.red, 8, 5.42, 6.43);
  solid(x, z - 1.5, 21, 17);
  landmark('FIRE STATION', x, z - 2, 15, '#e74e39');
}
function facadeSign(parent, label, maxWidth, x, y, z, color = '#174b88') {
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = 'bold 90px Arial';
  const panelHeight = 2.3, panelGap = .12, padding = 52;
  const maxPixels = maxWidth / panelHeight * 160;
  const textWidth = text => measure.measureText(text).width;
  let lines = Array.isArray(label) ? label : [label];
  if (lines.length === 1 && textWidth(lines[0]) + padding > maxPixels) {
    const words = lines[0].split(' ');
    if (words.length > 1) {
      let best = null;
      for (let split = 1; split < words.length; split++) {
        const candidate = [words.slice(0, split).join(' '), words.slice(split).join(' ')];
        const widest = Math.max(...candidate.map(textWidth));
        if (!best || widest < best.widest) best = { lines: candidate, widest };
      }
      lines = best.lines;
    }
  }
  lines.forEach((line, index) => {
    const fontSize = Math.min(90, 90 * (maxPixels - padding) / textWidth(line));
    measure.font = `bold ${fontSize}px Arial`;
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(Math.ceil(measure.measureText(line).width + padding), Math.floor(maxPixels));
    canvas.height = 160;
    const context = canvas.getContext('2d');
    context.fillStyle = color; context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#ffffff'; context.lineWidth = 12;
    context.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
    context.fillStyle = '#fff7d5'; context.font = `bold ${fontSize}px Arial`;
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(line, canvas.width / 2, 83, canvas.width - padding);
    const panelWidth = canvas.width / 160 * panelHeight;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(panelWidth, panelHeight),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), toneMapped: false }));
    sign.position.set(x, y + (lines.length - 1 - 2 * index) * (panelHeight + panelGap) / 2, z);
    parent.add(sign);
    measure.font = 'bold 90px Arial';
  });
}
function registerCivicFire(name, object, facadeZ, windowY = 3.4) {
  const site = BUILDING_SITES.find(entry => entry.pack === 'civic' && entry.name === name);
  if (!site) return;
  const windows = [-3.5, 0, 3.5].map((x, index) => {
    const width = 2.2, height = 1.7;
    return { id: `${name}-${index}`, side: '+Z', center: [x, windowY, facadeZ], width, height,
      corners: [[x-width/2,windowY-height/2,facadeZ],[x+width/2,windowY-height/2,facadeZ],
        [x+width/2,windowY+height/2,facadeZ],[x-width/2,windowY+height/2,facadeZ]] };
  });
  fireTargets.set(site.worldBuildingId, worldWindowTargets(THREE, object, windows));
  fireEffect.registerBuilding(site.worldBuildingId, object, windows, 0, 9);
  groundMarkers.registerFireSite(site.worldBuildingId, site.x, site.z, site.width, site.depth);
}
function townLibrary() {
  const x = -35, z = -77, g = group(x, z);
  box(g, 21, .5, 12, M.stone, 0, .25, 0);
  box(g, 19, 7, 10, M.wall, 0, 3.8, 0);
  box(g, 21, 1.2, 12, M.blue, 0, 7.8, 0);
  for (const xx of [-7,-4.5,4.5,7]) box(g, 1.7, 3.3, .12, M.glass, xx, 3.7, 5.08, false);
  box(g, 3.6, 4.6, .13, M.wood, 0, 2.45, 5.09);
  facadeSign(g, 'LIBRARY', 12, 0, 6.2, 5.17);
  solid(x, z, 21, 12); landmark('TOWN LIBRARY', x, z, 11, '#5dbad6');
  registerCivicFire('town-library', g, 5.1);
}
function sportsCenter() {
  const x = 35, z = -77, g = group(x, z);
  box(g, 23, .5, 13, M.stone, 0, .25, 0);
  box(g, 21, 8, 11, mat('#f7e3bb'), 0, 4.25, 0);
  box(g, 23, 1.5, 13, M.red, 0, 8.8, 0);
  for (const xx of [-8,-5,5,8]) box(g, 2.1, 3.6, .12, M.glass, xx, 4, 5.58, false);
  box(g, 4, 5.2, .15, M.darkBlue, 0, 2.85, 5.62);
  facadeSign(g, 'SPORTS CENTER', 16, 0, 7, 5.71, '#c94b3d');
  solid(x, z, 23, 13); landmark('SPORTS CENTER', x, z, 12, '#ee8c47');
  registerCivicFire('sports-center', g, 5.63);
}
function industrialFootbridge(x = 85, z = -23, title = 'FOOTBRIDGE') {
  const g = group(x, z);
  for (const side of [-1, 1]) {
    box(g, .7, 6, .7, M.metal, side * 7.5, 3, 0);
    box(g, 1.5, .5, 2, M.yellow, side * 7.5, .25, 0);
    solid(x + side * 7.5, z, 1.5, 2);
  }
  box(g, 18, .45, 2.2, M.wood, 0, 6.3, 0);
  for (const side of [-1,1]) box(g, 18, .8, .15, M.blue, 0, 6.95, side * 1.05);
  landmark(title, x, z, 9, '#eab94a');
}
function townHall() {
  const x = 0, z = -15, g = group(x, z);
  box(g, 22, 1, 17, M.stone, 0, .5, 0);
  box(g, 19, 8, 12, M.wall, 0, 5, -2);
  box(g, 21, 1.25, 14, M.darkBlue, 0, 9.65, -2);
  for (const xx of [-6.5,-3.25,0,3.25,6.5]) cylinder(g, .47, .52, 6.3, M.wall, xx, 4.2, 5.25);
  box(g, 19, .7, 1.8, M.stone, 0, 7.65, 5.2);
  box(g, 4.5, 4.6, 4.5, M.wall, 0, 12.5, -2);
  cylinder(g, 2.6, 2.6, .8, M.darkBlue, 0, 15.1, -2, 8);
  const clock = new THREE.Mesh(new THREE.CircleGeometry(1.25, 24), M.yellow);
  clock.position.set(0, 13.1, .29); g.add(clock);
  box(g, .11, .85, .04, M.darkBlue, 0, 13.3, .32, false);
  box(g, .58, .1, .04, M.darkBlue, .18, 13.03, .33, false);
  box(g, 5.2, 3.2, .14, M.wood, 0, 2.65, 5.1);
  solid(x, z, 22, 17);
  landmark('TOWN HALL', x, z, 17, '#eab94a');
}
function museum() {
  const x = 35, z = -47, g = group(x, z);
  box(g, 21, .65, 18, M.stone, 0, .33, 0);
  box(g, 20, 7, 13, M.wall, 0, 4.1, -2);
  for (const xx of [-7.5,-4.5,-1.5,1.5,4.5,7.5]) cylinder(g, .52, .62, 6, M.wall, xx, 4.2, 5.25);
  box(g, 22, 1.05, 17.5, M.stone, 0, 8.15, -1);
  const pediment = new THREE.Mesh(new THREE.ConeGeometry(11, 3.5, 4), M.wall);
  pediment.rotation.y = Math.PI / 4;
  pediment.scale.z = .26;
  pediment.position.set(0, 10, -1.1);
  g.add(pediment);
  box(g, 3.8, 3.8, .14, M.darkBlue, 0, 2.6, 4.6);
  solid(x, z, 21, 18);
  landmark('MUSEUM', x, z - 1, 14, '#e4b744');
}
function school() {
  const x = -67, z = 21, g = group(x, z);
  box(g, 20, .5, 17, M.stone, 0, .25, 0);
  box(g, 20, 7.2, 13.5, M.wall, 0, 4.1, -1);
  box(g, 20, 1.25, 15, M.yellow, 0, 8.4, -1);
  windows(g, 18, 2, 2.5, 5.82, 3);
  box(g, 3.5, 4.6, .18, M.blue, 0, 2.8, 5.88);
  awning(g, 0, 6.8, 5, M.red);
  cylinder(g, .07, .07, 8, M.metal, 9, 6, 6);
  box(g, 3.6, 2.2, .08, M.red, 10.8, 9.1, 6, false);
  solid(x, z, 20, 17);
  landmark('SCHOOL', x, z - 1, 12, '#f0b847');
}
function hospital() {
  const x = -67, z = 54, g = group(x, z);
  box(g, 20, .45, 18, M.stone, 0, .23, 0);
  box(g, 19, 10, 14, mat('#f4f8e9'), 0, 5.45, -1);
  box(g, 21, 1, 16, M.blue, 0, 10.9, -1);
  windows(g, 18, 3, 2.6, 6.12, 2.8);
  box(g, 3.2, 4.5, .2, M.glass, 0, 2.8, 6.2, false);
  box(g, 1.1, 3.4, .25, M.red, 0, 8.3, 6.25);
  box(g, 3.4, 1.1, .25, M.red, 0, 8.3, 6.25);
  solid(x, z, 20, 18);
  landmark('HOSPITAL', x, z - 1, 14, '#ee6156');
}
function square() {
  const x = 0, z = 21;
  disc(scene, 11, M.stone, x, .015, z, 48);
  disc(scene, 10.6, M.pavement, x, .025, z, 48);
  disc(scene, 5.4, M.stone, x, .035, z, 36);
  cylinder(scene, 4.1, 4.7, .7, M.blue, x, .53, z, 28);
  cylinder(scene, 3.75, 3.75, .06, mat('#68c8e3', .2), x, .92, z, 28);
  cylinder(scene, .5, .75, 3.6, M.stone, x, 2.6, z, 16);
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), M.blue);
  sphere.position.set(x, 4.6, z); sphere.castShadow = true; scene.add(sphere);
  solid(x, z, 7.7, 7.7);
  for (const [bx,bz,rot] of [[-8,15,0],[8,15,0],[-8,27,Math.PI],[8,27,Math.PI]]) bench(bx,bz,rot);
  for (const [tx,tz] of [[-9.5,12],[9.5,12],[-9.5,30],[9.5,30]]) tree(tx,tz,4.6);
  landmark('TOWN SQUARE', x, z, 7, '#5bbca7');
}
function hydrant(x,z) {
  const g = group(x,z);
  g.scale.setScalar(.65);
  g.position.y = getSurfaceHeight(x,z);
  solid(x,z,1.24,1.24);
  cylinder(g, .43, .53, 1.22, M.red, 0, .72, 0, 12);
  cylinder(g, .58, .58, .22, M.darkRed, 0, 1.35, 0, 12);
  cylinder(g, .23, .23, .67, M.red, 0, 1.68, 0, 12);
  const top = new THREE.Mesh(new THREE.SphereGeometry(.31,12,8), M.red); top.position.y = 2; g.add(top);
  const side = cylinder(g, .2, .2, 1.6, M.red, 0, .93, 0, 10); side.rotation.z = Math.PI / 2;
  cylinder(g, .25, .25, .14, M.yellow, -.83, .93, 0, 10).rotation.z = Math.PI / 2;
  cylinder(g, .25, .25, .14, M.yellow, .83, .93, 0, 10).rotation.z = Math.PI / 2;
  cylinder(g, .67, .67, .18, M.darkRed, 0, .13, 0, 12);
}
function bench(x,z,rotation=0) {
  const g = group(x,z); g.rotation.y = rotation; g.position.y = getSurfaceHeight(x,z);
  solid(x,z,3.1,1);
  box(g, 3.1, .28, .85, M.wood, 0, .85, 0);
  box(g, 3.1, 1.15, .18, M.wood, 0, 1.45, -.46);
  for (const xx of [-1.2,1.2]) box(g, .2, .9, .6, M.metal, xx, .42, 0);
}
function clearScenery(x,z,radius=1) {
  return !isReserved(x,z,radius) && !solids.some(b=>Math.abs(x-b.x)<b.w/2+radius&&Math.abs(z-b.z)<b.d/2+radius);
}
function tree(x,z,s=5.5) {
  if(!clearScenery(x,z,.9))return;
  model('suburban', random()>.35?'tree-large':'tree-small', x,z,s,random()*Math.PI*2,getSurfaceHeight(x,z));
  solid(x,z,.4,.4);
}
function building(site) {
  if (site.pack === 'civic') return null;
  const {pack,name,x,z,scale,width,depth,rotation=0}=site;
  const item=model(pack,name,x,z,scale,rotation);
  const bounds=new THREE.Box3().setFromObject(item),size=bounds.getSize(new THREE.Vector3());
  if (pack !== 'suburban') item.scale.multiplyScalar(Math.min(1,width/size.x,depth/size.z));
  bounds.setFromObject(item);
  const center=bounds.getCenter(new THREE.Vector3());
  item.position.x+=x-center.x;item.position.z+=z-center.z;
  item.position.y+=getSurfaceHeight(x,z)-bounds.min.y;
  bounds.setFromObject(item);bounds.getSize(size);
  solid(x,z,size.x,size.z);
  item.userData.site=site;
  item.userData.buildingTypeId=BUILDING_TYPES_BY_PATH.get(`${pack}/${name}`)?.id;
  item.userData.worldBuildingId=site.worldBuildingId;
  const sourceBounds=new THREE.Box3().setFromObject(models.get(`${pack}/${name}`));
  if(site.worldBuildingId){
    const windows=WINDOW_MAP[`${pack}/${name}`]??[];
    fireTargets.set(site.worldBuildingId,worldWindowTargets(THREE,item,windows));
    fireEffect.registerBuilding(site.worldBuildingId,item,windows,sourceBounds.min.y,sourceBounds.max.y,INDUSTRIAL_CHIMNEYS[`${pack}/${name}`]??[]);
    groundMarkers.registerFireSite(site.worldBuildingId,site.x,site.z,size.x,size.z);
  }
  if (site.questName) {
    const sign = group(site.x, site.z);
    const shortName = site.questName.replace('Neighborhood ', '').replace(' Station', ' STATION');
    const signLabel = site.questName === 'Canal Workshop' ? ['CANAL', 'WORKSHOP'] : shortName.toUpperCase();
    facadeSign(sign, signLabel, Math.min(14, size.x * .8), 0, 5.3, bounds.max.z - site.z + .12,
      site.pack === 'industrial' ? '#965837' : '#286b91');
    landmark(site.questName.toUpperCase(), site.x, site.z, 13, '#75d2e1');
  }
  return item;
}
function farmAndParks() {
  const barn = group(-98,-219);
  box(barn,14,.4,16,M.stone,0,.15,0);
  box(barn,12.5,6.2,13.5,M.red,0,3.2,0);
  for (const side of [-1,1]) {
    const roof = box(barn,8.2,.55,14.5,M.darkRed,side*3.25,7.5,0);
    roof.rotation.z = -side*.46;
  }
  box(barn,5.2,4.8,.18,M.wood,0,2.6,6.85);
  for(const side of [-1,1]) {
    const brace=box(barn,.25,6.5,.22,M.wall,0,2.6,6.98);
    brace.rotation.z=side*.7;
  }
  facadeSign(barn,'SUNNY BARN',10,0,5.6,7.02,'#ad342f');
  solid(-98,-219,14,16);landmark('SUNNY FARM',-98,-219,11,'#eeae4d');
  registerCivicFire('barn',barn,6.96,3.2);

  const home=group(-67,-219);
  box(home,14,.45,15,M.stone,0,.2,0);
  box(home,12.5,5.8,12.5,M.wall,0,3.2,0);
  for(const side of [-1,1]) {
    const roof=box(home,8,.5,13.5,M.yellow,side*3.25,7.3,0);
    roof.rotation.z=-side*.44;
    box(home,2.2,2.2,.12,M.glass,side*3.8,3.7,6.32,false);
  }
  box(home,2.6,4,.16,M.blue,0,2.35,6.37);
  facadeSign(home,'FARMHOUSE',10,0,5.7,6.48,'#419775');
  solid(-67,-219,14,15);landmark('FARMHOUSE',-67,-219,10,'#a9d26b');
  registerCivicFire('farmhouse',home,6.34,3.6);

  const pavilion=group(-98,-151);
  disc(pavilion,7,M.stone,0,.015,0);
  for(const x of [-5,5]) for(const z of [-5,5]) box(pavilion,.55,5,.55,M.wood,x,2.5,z);
  const canopy=new THREE.Mesh(new THREE.ConeGeometry(9,3.5,4),M.yellow);
  canopy.rotation.y=Math.PI/4;canopy.position.y=6.3;canopy.castShadow=true;pavilion.add(canopy);
  box(pavilion,5,.25,2.2,M.wood,0,1,0);
  for(const x of [-3.5,0,3.5]) {
    const bush=new THREE.Mesh(new THREE.SphereGeometry(1.1,10,7),M.leaves);
    bush.position.set(x,1.05,5.4);bush.castShadow=true;pavilion.add(bush);
  }
  solid(-98,-151,10,10);landmark('PICNIC PAVILION',-98,-151,9,'#eeb760');
  registerCivicFire('picnic-pavilion',pavilion,5.4,1.25);

  for(let row=0;row<5;row++) for(let col=0;col<4;col++) {
    const x=-103+col*3.3,z=-191+row*3.2;
    const plant=group(x,z);
    const carrot=new THREE.Mesh(new THREE.ConeGeometry(.36,1.1,8),mat('#f58d35'));
    carrot.rotation.z=Math.PI;carrot.position.y=.45;plant.add(carrot);
    cylinder(plant,.36,.14,.65,M.leaves,0,1.13,0,5);
  }
  landmark('CARROT FIELDS',-98,-185,4,'#f9b660');
  disc(scene,6.5,mat('#72bed5',.2),-67,-.035,-185,36);
  cylinder(scene,6.6,6.6,.1,M.stone,-67,-.11,-185,36);
  disc(scene,6.1,mat('#72bed5',.2),-67,-.04,-185,36);
  landmark('FARM POND',-67,-185,4,'#70c8e0');

  const playground=group(35,-151);
  disc(playground,7,M.park,0,.01,0);
  for(const x of [-3,3]) box(playground,.35,5,.35,M.blue,x,2.5,-2);
  box(playground,7,.35,.35,M.blue,0,5.1,-2);
  for(const x of [-1.8,1.8]) {box(playground,.06,3,.06,M.metal,x,3.4,-2);box(playground,1.7,.18,.8,M.yellow,x,1.85,-2);}
  box(playground,2.2,2.2,2.2,M.red,3,1.1,3);
  landmark('PLAYGROUND',35,-151,7,'#e68fc1');
  const sports=group(-67,-151);
  disc(sports,7.5,M.park,0,.015,0);
  box(sports,11,.06,.1,M.wall,0,.07,0,false);
  for(const x of [-5.7,5.7]) box(sports,.1,2,.1,M.wall,x,1,0);
  landmark('SPORTS PARK',-67,-151,5,'#8bcc77');
}
function buildBlocks() {
  BUILDING_SITES.forEach(building);
  farmAndParks();
  landmark('INDUSTRIAL YARDS',68,-12,16,'#d08f5c');
  landmark('THE YARDS',99,46,9,'#e5a36b');
  // Parked vehicles have their own space inside lots, never in through lanes.
  model('cars','ambulance',-74.7,62,1.2,Math.PI/2,getSurfaceHeight(-74.7,62));
  solid(-74.7,62,4.1,1.8);
}
function details() {
  // Reserve the open corners of each lot for greenery.
  for(let i=0;i<230;i++) {
    const x=-107+random()*214,z=-56+random()*119;
    if(x>54&&random()>.3)continue;
    if(Math.abs(x)<12&&z>9&&z<33)continue;
    tree(x,z,4.2+random()*1.4);
  }
  for(let i=0;i<220;i++) {
    const x=-120+random()*250,z=-250+random()*137;
    if(CIVIC_ENVELOPES.some(site=>Math.abs(x-site.x)<site.width/2+2&&Math.abs(z-site.z)<site.depth/2+2))continue;
    tree(x,z,4+random()*1.8);
  }
  for(const {x,z} of HYDRANT_LOCATIONS)hydrant(x,z);
  // Lamppost bases occupy the sidewalk's outer edge and avoid driveways.
  for(const x of avenueX)for(const z of [-46,-12,22,54]) {
    const lx=x+5.5;
    if(surfaceAt(lx,z)==='pavement'&&!solids.some(b=>Math.abs(lx-b.x)<b.w/2+.3&&Math.abs(z-b.z)<b.d/2+.3))
      model('roads','light-curved',lx,z,6.2,Math.PI/2,getSurfaceHeight(lx,z));
  }
  for(const [x,z,r] of [[-9,60,0],[8,60,Math.PI],[-94,80,Math.PI],[-65,80,Math.PI],[-37,80,Math.PI],[37,80,Math.PI],[66,80,Math.PI],[99,80,Math.PI]]) {
    if(clearScenery(x,z,1.6))bench(x,z,r);
  }
  for(const x of [-98,-67,-35,0,35,68,99])tree(x,75,4.8);
  landmark('HARBOR WALK',12,89,4,'#49bad5');
}

let firetruck, waterEffect;
function createTruck() {
  firetruck = new THREE.Group(); scene.add(firetruck);
  const truckModel = model('cars','firetruck',0,0,FIRETRUCK.scale,0,0,firetruck);
  firetruck.userData.model=truckModel;
  firetruck.userData.wheels=[];
  truckModel.traverse(node=>{if(node.name.startsWith('wheel-'))firetruck.userData.wheels.push(node);});
  truckModel.traverse(node => { if(node.isMesh) node.castShadow = true; });
  const blueLight = new THREE.PointLight('#88d9ff', 0, 8);
  blueLight.position.set(0, 2.9, -.15); firetruck.add(blueLight);
  firetruck.userData.blueLight = blueLight;
  waterEffect = createWaterEffect(THREE, scene, firetruck, getSurfaceHeight, surfaceAt, point => groundMarkers.addGroundImpact(point));
  firetruck.position.set(player.x,getSurfaceHeight(player.x,player.z),player.z);
  firetruck.rotation.y=player.heading;
}

const spawnValues = new URLSearchParams(location.search).get('spawn')?.split(',').map(Number);
const debugSpawn = spawnValues?.length >= 2 && spawnValues.every(Number.isFinite)
  ? {x:spawnValues[0],z:spawnValues[1],heading:spawnValues[2] ?? -Math.PI/2} : null;
const player = createVehicleState(debugSpawn ?? {x:35,z:38,heading:-Math.PI/2});
let previousPhysicsPose = {...player}, renderPose = {...player}, hoseTarget = null;
let truckVisualY = getSurfaceHeight(player.x, player.z);
const waterBoost = createWaterBoostState();
const refillRing = new THREE.Mesh(
  new THREE.RingGeometry(1.3, 1.55, 40),
  new THREE.MeshBasicMaterial({color:'#80eaff',transparent:true,opacity:.55,depthWrite:false,side:THREE.DoubleSide}),
);
refillRing.rotation.x = -Math.PI / 2;
refillRing.visible = false;
refillRing.renderOrder = 3;
scene.add(refillRing);
let physicsAccumulator=0;
// One dynamic mesh holds the tire trails, so a long drift does not create hundreds of draw calls.
const MAX_SKID_SEGMENTS = 2400;
const skidPositions = new Float32Array(MAX_SKID_SEGMENTS * 18);
const skidGeometry = new THREE.BufferGeometry();
skidGeometry.setAttribute('position', new THREE.BufferAttribute(skidPositions, 3).setUsage(THREE.DynamicDrawUsage));
skidGeometry.setDrawRange(0, 0);
const skidMesh = new THREE.Mesh(skidGeometry, new THREE.MeshBasicMaterial({ color: '#24313b', transparent: true, opacity: .60, depthWrite: false, side: THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-2 }));
skidMesh.frustumCulled = false;
skidMesh.renderOrder = 2;
scene.add(skidMesh);
let skidCount = 0, skidNext = 0, previousWheels = null;
function addSkidSegment(a, b, width = FIRETRUCK.tireWidth) {
  const length = Math.hypot(b.x-a.x, b.z-a.z);
  if(length < .025) return;
  const sidewaysX = -(b.z-a.z)/length*width/2;
  const sidewaysZ = (b.x-a.x)/length*width/2;
  const ay = getSurfaceHeight(a.x,a.z)+.018, by = getSurfaceHeight(b.x,b.z)+.018, index = skidNext * 18;
  const corners = [
    a.x+sidewaysX,ay,a.z+sidewaysZ,
    a.x-sidewaysX,ay,a.z-sidewaysZ,
    b.x+sidewaysX,by,b.z+sidewaysZ,
    b.x+sidewaysX,by,b.z+sidewaysZ,
    a.x-sidewaysX,ay,a.z-sidewaysZ,
    b.x-sidewaysX,by,b.z-sidewaysZ,
  ];
  skidPositions.set(corners,index);
  skidNext = (skidNext+1)%MAX_SKID_SEGMENTS;
  skidCount = Math.min(skidCount+1,MAX_SKID_SEGMENTS);
  skidGeometry.attributes.position.needsUpdate = true;
  skidGeometry.setDrawRange(0,skidCount*6);
}
function updateSkids(isBraking, speed) {
  if(!isBraking || speed < 2.5) { previousWheels = null; return; }
  const wheels=wheelContacts(player);
  if(previousWheels)for(let i=0;i<2;i++) {
    const a=previousWheels[i],b=wheels[i];
    const paved=p=>['road','driveway','pavement','deck'].includes(surfaceAt(p.x,p.z));
    if(paved(a)&&paved(b)&&Math.hypot(b.x-a.x,b.z-a.z)<.8)addSkidSegment(a,b);
  }
  previousWheels=wheels;
}
const keys = new Set();
let playing=false, orbit=-.28, pitch=.7, zoom=36, cameraPointer=null, lastX=0,lastY=0;
const vehicleSound=createVehicleSound(undefined,`${import.meta.env.BASE_URL}assets/tire-skid.mp3`);
const missionSound=createMissionSound();
const touchControls=createTouchControls({
  root:document.querySelector('#touch-controls'),
  stick:document.querySelector('#drive-stick'),
  knob:document.querySelector('#drive-stick-knob'),
  brake:document.querySelector('#touch-brake'),
  isPlaying:()=>playing,
});
const boostButton=document.querySelector('#boost-button');
const boostPointers=new Set();
function releaseBoost() {
  const pointers=[...boostPointers];
  boostPointers.clear();
  pointers.forEach(id=>{if(boostButton.hasPointerCapture(id))boostButton.releasePointerCapture(id);});
  boostButton.setAttribute('aria-pressed','false');
}
boostButton.addEventListener('pointerdown',e=>{
  if(!playing||e.button!==0)return;
  e.preventDefault();
  boostPointers.add(e.pointerId);
  boostButton.setPointerCapture(e.pointerId);
  boostButton.setAttribute('aria-pressed','true');
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])boostButton.addEventListener(type,e=>{
  if(!boostPointers.has(e.pointerId))return;
  boostPointers.delete(e.pointerId);
  if(boostButton.hasPointerCapture(e.pointerId))boostButton.releasePointerCapture(e.pointerId);
  boostButton.setAttribute('aria-pressed',String(boostPointers.size>0));
});
boostButton.addEventListener('contextmenu',e=>e.preventDefault());
function releaseCamera() {
  const pointerId=cameraPointer;
  cameraPointer=null;
  if(pointerId!==null&&canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);
  canvas.style.cursor=playing?'grab':'default';
}
function resetInput() {keys.clear();touchControls.reset();releaseBoost();releaseCamera();previousWheels=null;physicsAccumulator=0;previousPhysicsPose={...player};renderPose={...player};hoseTarget=null;hose.reset();hoseEffect.reset();waterBoost.active=false;waterBoost.spraying=false;refillRing.visible=false;boostButton.classList.remove('active');vehicleSound.pause();missionSound.stopCharge();}
const portraitUrls = import.meta.glob('../visuals/processed/*.png', { eager: true, query: '?url', import: 'default' });
const missionPanel = document.querySelector('#mission-panel');
const missionContent = document.querySelector('#mission-content');
const missionStatus = document.querySelector('#mission-status');
const phoneButton = document.querySelector('#phone-button');
const starCounter = document.querySelector('#star-counter');
const playingCharacterId = 'bunny';
const missionDeck = createMissionDeck(PLAYABLE_MISSIONS.filter(mission => mission.character_id !== playingCharacterId));
let activeMission = null, missionProgress = null, selectedMission = null, activeFireSiteId = null, panelOpen = false;
function updateStars() {
  starCounter.textContent = `★ ${missionDeck.completedCount}/${missionDeck.total} MISSIONS`;
  starCounter.setAttribute('aria-label', `Stars: ${missionDeck.completedCount} out of ${missionDeck.total} missions`);
  phoneButton.classList.toggle('all-complete', missionDeck.isComplete);
  phoneButton.querySelector('b').textContent = missionDeck.isComplete ? '★' : '!';
  const phoneLabel = missionDeck.isComplete ? 'All missions complete' : activeMission ? 'View current mission'
    : missionDeck.current ? 'View mission call' : 'Get a random mission';
  phoneButton.setAttribute('aria-label', phoneLabel);
  phoneButton.title = phoneLabel;
}
updateStars();
function missionPortrait(path) { return portraitUrls[`../${path}`] ?? ''; }
function makeDialogue(mission, line, onReply, bunnyTurn = false, phase = 'start', nextLabel = 'Continue') {
  const scene = document.createElement('div'); scene.className = `mission-dialogue ${bunnyTurn ? 'dialogue-bunny-turn' : 'dialogue-caller-turn'}`;
  const portraits = document.createElement('div'); portraits.className = 'dialogue-portraits';
  const bunnyPortrait = phase === 'start' && ['fire', 'rescue'].includes(mission.type)
    ? 'visuals/processed/BUNNY_2_run.png' : 'visuals/processed/BUNNY_1_idle.png';
  for (const [side, path, name] of [
    ['caller', line.sprite ?? mission.dialogue.start.find(item => item.sprite)?.sprite, line.speaker],
    ['bunny', bunnyPortrait, 'Bunny'],
  ]) {
    const character = document.createElement('div'); character.className = `dialogue-character dialogue-${side}`;
    const image = document.createElement('img'); image.src = missionPortrait(path); image.alt = name;
    character.append(image); portraits.append(character);
  }
  const message = document.createElement('div'); message.className = 'dialogue-message';
  const speaker = document.createElement('strong'); speaker.textContent = line.speaker;
  const copy = document.createElement('p'); copy.textContent = line.text;
  message.append(speaker, copy);
  scene.append(portraits, message);
  if (bunnyTurn) {
    scene.append(missionButton(nextLabel, onReply, 'dialogue-reply'));
    return scene;
  }
  const reply = missionButton(line.reply, onReply, 'dialogue-reply');
  reply.setAttribute('aria-label', `Bunny replies: ${line.reply}`);
  const replyName = document.createElement('span'); replyName.textContent = 'BUNNY REPLIES';
  const replyText = document.createElement('strong'); replyText.textContent = line.reply;
  reply.replaceChildren(replyName, replyText);
  scene.append(reply);
  return scene;
}
function missionButton(label, action, className = 'mission-action') {
  const button = document.createElement('button'); button.type = 'button'; button.className = className;
  button.textContent = label; button.addEventListener('click', action); return button;
}
function appendDialogueSequence(mission, phase, onDone) {
  const host = document.createElement('div');
  missionContent.append(host);
  const lines = dialogueBeats(mission, phase);
  let index = 0;
  function showLine() {
    host.replaceChildren(makeDialogue(mission, lines[index], () => {
      const reply = lines[index].reply;
      const isLast = index === lines.length - 1;
      host.replaceChildren(makeDialogue(mission, { speaker: 'Bunny', text: reply }, () => {
        if (!panelOpen || !host.isConnected) return;
        index++;
        if (index < lines.length) showLine();
        else onDone();
      }, true, phase, isLast && phase === 'start' ? 'Start mission' : 'Continue'));
    }, false, phase));
  }
  if (lines.length) showLine(); else onDone();
}
function openPanel() {
  if (!playing) return;
  if (!activeMission) { selectedMission = missionDeck.next(); updateStars(); }
  panelOpen = true; resetInput();
  if (selectedMission) missionSound.playCall();
  missionPanel.classList.remove('hidden'); renderMissionPanel();
}
function closePanel() { panelOpen = false; missionPanel.classList.add('hidden'); selectedMission = null; updateMissionStatus(); }
function renderMissionPanel() {
  missionContent.replaceChildren();
  const heading = document.querySelector('#mission-panel-title');
  if (selectedMission) {
    heading.textContent = selectedMission.title;
    const place = document.createElement('p'); place.className = 'mission-place'; place.textContent = selectedMission.label;
    const objective = document.createElement('p'); objective.className = 'mission-objective'; objective.textContent = selectedMission.objective;
    missionContent.append(place, objective);
    appendDialogueSequence(selectedMission, 'start', () => startMission(selectedMission));
    missionContent.append(missionButton('Back to city', closePanel, 'mission-secondary'));
  } else if (activeMission) {
    heading.textContent = activeMission.title;
    const detail = document.createElement('p'); detail.className = 'mission-objective'; detail.textContent = missionStatus.textContent;
    missionContent.append(detail, missionButton('Keep helping ➜', closePanel));
  } else if (missionDeck.isComplete) {
    heading.textContent = 'Every mission complete! ★';
    const message = document.createElement('p'); message.className = 'mission-objective';
    message.textContent = `You earned all ${missionDeck.total} stars. The whole city is smiling!`;
    missionContent.append(message, missionButton('Back to the city', closePanel));
  } else {
    heading.textContent = 'New mission';
    const message = document.createElement('p'); message.className = 'mission-objective';
    message.textContent = 'Tap the phone to receive your next call.';
    missionContent.append(message, missionButton('Back to the city', closePanel));
  }
}
function refreshMissionMarkers() {
  if (!activeMission) { missionMarkers.clear(); return; }
  if (activeMission.type === 'fire') {
    // The burning site already has its own ground square and fire direction cue.
    missionMarkers.clear();
  } else if (activeMission.type === 'collect') {
    if (missionProgress.stage === 'returning') missionMarkers.set([{ point: activeMission.target, kind: 'return' }]);
    else missionMarkers.set(activeMission.pickups.flatMap((point, index) => missionProgress.collected.has(index) ? [] : [{ point, kind: activeMission.markerKind ?? 'collect' }]));
  } else if (activeMission.type === 'race') {
    missionMarkers.set([{ point: activeMission.route[missionProgress.checkpoint], kind: 'race' }]);
  } else missionMarkers.set([{ point: activeMission.target, kind: activeMission.type }]);
}
function updateMissionStatus() {
  if (!activeMission) {
    missionStatus.textContent = missionDeck.isComplete ? `★ All ${missionDeck.total} missions complete!`
      : missionDeck.current ? '📱 Your mission call is waiting on the phone' : '📱 Tap the phone for a new mission';
    return;
  }
  if (activeMission.type === 'collect') missionStatus.textContent = missionProgress.stage === 'returning'
    ? `📦 All ${activeMission.mechanics.item_count} ${activeMission.pickupLabel} found! Stop at ${activeMission.returnLabel} for 2 seconds`
    : `📦 ${missionProgress.collectedCount}/${activeMission.mechanics.item_count} ${activeMission.pickupLabel} · Follow the glowing ! markers`;
  else if (activeMission.type === 'race') missionStatus.textContent = `🏁 ${missionProgress.checkpoint}/${activeMission.route.length} rings · Follow the next glowing marker`;
  else if (activeMission.type === 'fire') missionStatus.textContent = `🔥 ${activeMission.title} · Drive close to the marker to spray`;
  else missionStatus.textContent = `${activeMission.type === 'fix' ? '🔧' : '🐾'} ${activeMission.objective} · ${activeMission.type === 'fix' ? 'Stop at the marker for 6 seconds' : 'Stop at the marker for 2 seconds'}`;
}
function startMission(mission) {
  if (activeMission) finishMission(false, true);
  activeMission = mission;
  missionProgress = createMissionProgress(mission);
  activeFireSiteId = null;
  fireState.clear(); fireProgress.clear(); fireEffect.clear();
  if (mission.type === 'fire') {
    const site = BUILDING_SITES.find(candidate => candidate.x === mission.fireSite.x && candidate.z === mission.fireSite.z && candidate.worldBuildingId);
    if (site) { activeFireSiteId = site.worldBuildingId; fireState.set(site.worldBuildingId, 55); }
  }
  fireStatus.classList.toggle('hidden', mission.type !== 'fire');
  lastFireCount = -1;
  phoneButton.classList.add('on-mission');
  updateStars();
  updateMissionStatus(); refreshMissionMarkers(); closePanel();
}
function finishMission(success, silent = false) {
  const mission = activeMission;
  if (!mission) return;
  missionSound.stopCharge();
  activeMission = null; missionProgress = null; selectedMission = null; activeFireSiteId = null;
  fireState.clear(); fireEffect.clear(); fireProgress.clear(); missionMarkers.clear();
  fireStatus.classList.add('hidden'); phoneButton.classList.remove('on-mission');
  if (success) missionDeck.complete(mission.id);
  updateStars();
  updateMissionStatus();
  if (silent) return;
  resetInput(); panelOpen = true; missionPanel.classList.remove('hidden');
  document.querySelector('#mission-panel-title').textContent = success ? 'Mission complete! ★' : 'Mission paused';
  missionContent.replaceChildren();
  appendDialogueSequence(mission, success ? 'success' : 'failure', () => {
    missionContent.replaceChildren();
    const message = document.createElement('p'); message.className = 'mission-objective';
    message.textContent = success ? `★ ${missionDeck.completedCount}/${missionDeck.total} missions complete` : 'This call is saved on your phone.';
    missionContent.append(message, missionButton('Back to the city', closePanel));
  });
  missionContent.append(missionButton('Back to the city', closePanel, 'mission-secondary'));
}
function advanceMission(dt) {
  if (!activeMission || panelOpen) return;
  const previousStage = missionProgress.stage, previousCount = missionProgress.collectedCount;
  const speed = vehicleMotion(player).speed;
  const fireOut = activeMission.type === 'fire' && activeFireSiteId
    && fireProgress.hasHit(activeFireSiteId) && !fireState.onFire.has(activeFireSiteId);
  const stage = missionProgress.update({...renderPose, speed}, fireOut, dt);
  if (missionProgress.collectedCount > previousCount && activeMission.type === 'collect') missionSound.playCollect();
  if (stage === 'complete') { finishMission(true); return; }
  const holdKind = stage === 'returning' ? 'return' : ['fix', 'rescue'].includes(activeMission.type) ? activeMission.type : null;
  if (holdKind) {
    const atMarker = speed <= 1 && Math.hypot(renderPose.x - activeMission.target.x, renderPose.z - activeMission.target.z) <= 7;
    missionMarkers.setProgress(holdKind, missionProgress.holdProgress, atMarker);
    missionSound.updateCharge(atMarker, missionProgress.holdProgress);
  } else missionSound.stopCharge();
  if (stage !== previousStage || missionProgress.collectedCount !== previousCount) {
    updateMissionStatus(); refreshMissionMarkers();
  }
}
phoneButton.addEventListener('click', openPanel);
document.querySelector('#mission-close').addEventListener('click', closePanel);
window.addEventListener('keydown',e=>{
  if (panelOpen) { if (e.code === 'Escape') closePanel(); return; }
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(playing)vehicleSound.start();
  keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('pointerdown',()=>{if(playing)vehicleSound.start();},{passive:true});
window.addEventListener('blur',resetInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetInput();});
canvas.addEventListener('pointerdown',e=>{if(!playing||cameraPointer!==null||e.button!==0)return;cameraPointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';});
canvas.addEventListener('pointermove',e=>{if(e.pointerId!==cameraPointer)return;orbit-=(e.clientX-lastX)*.006;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-lastY)*.004,.15,1.18);lastX=e.clientX;lastY=e.clientY;});
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(e.pointerId===cameraPointer)releaseCamera();});
canvas.addEventListener('wheel',e=>{if(!playing)return;e.preventDefault();zoom=THREE.MathUtils.clamp(zoom+e.deltaY*.018,14,55);},{passive:false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.querySelector('#start-button').addEventListener('click',()=>{missionSound.unlock();missionDeck.startSession();resetInput();startFires();playing=true;updateMissionStatus();vehicleSound.start();document.querySelector('#menu').classList.add('hidden');document.querySelector('#hud').classList.remove('hidden');canvas.style.cursor='grab';});
document.querySelector('#menu-button').addEventListener('click',()=>{playing=false;resetInput();closePanel();finishMission(false,true);fireState.clear();document.querySelector('#menu').classList.remove('hidden');document.querySelector('#hud').classList.add('hidden');});

function drive(dt) {
  if(!playing||!firetruck||panelOpen){physicsAccumulator=0;return;}
  const input={
    throttle:(Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')))||touchControls.input.throttle,
    steer:(Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')))||touchControls.input.steer,
    handbrake:keys.has('Space')||touchControls.input.handbrake,
  };
  const boostHeld=keys.has('ShiftLeft')||keys.has('ShiftRight')||boostPointers.size>0;
  boostButton.setAttribute('aria-pressed',String(boostHeld));
  physicsAccumulator+=dt;
  let motion=vehicleMotion(player);
  while(physicsAccumulator>=VEHICLE_STEP){
    previousPhysicsPose={...player};
    const nearbyFire=nearestBurningBuilding(player,BUILDING_SITES,fireState.onFire);
    const boost=boostHeld&&!nearbyFire&&input.throttle>0&&waterBoost.charge>0&&!waterBoost.needsRelease;
    motion=advanceVehicle(player,{...input,boost},VEHICLE_STEP,solids);
    hoseTarget=nearestBurningBuilding(player,BUILDING_SITES,fireState.onFire);
    stepWaterBoost(waterBoost,player,{held:boostHeld&&!nearbyFire&&!motion.blocked,throttle:input.throttle},VEHICLE_STEP,undefined,{normal:waterTuning.waterRegen,hydrant:waterTuning.hydrantRegen});
    if(motion.blocked)previousWheels=null;
    updateSkids(input.handbrake,motion.speed);
    physicsAccumulator-=VEHICLE_STEP;
  }
  renderPose=interpolateVehiclePose(previousPhysicsPose,player,physicsAccumulator/VEHICLE_STEP);
  const groundHeight=Math.max(...[...wheelContacts(renderPose),...wheelContacts(renderPose,'front')].map(p=>getSurfaceHeight(p.x,p.z)));
  truckVisualY += (groundHeight - truckVisualY) * (1 - Math.exp(-8 * dt));
  firetruck.position.set(renderPose.x,truckVisualY,renderPose.z);
  firetruck.rotation.y=renderPose.heading;
  for(const wheel of firetruck.userData.wheels){
    wheel.rotation.x=renderPose.wheelSpin;
    if(wheel.name.includes('front'))wheel.rotation.y=-renderPose.steeringAngle;
  }
  firetruck.userData.blueLight.intensity=.7+.7*Math.sin(performance.now()*.013)**8;
  document.querySelector('#speed-value').textContent=String(Math.round(motion.speed*3.6)).padStart(2,'0');
  document.querySelector('#drift-indicator').classList.toggle('active',input.handbrake&&motion.speed>3);
  const charge=Math.round(waterBoost.charge);
  const meter=document.querySelector('#water-meter');
  meter.setAttribute('aria-valuenow',String(charge));
  meter.classList.toggle('near-hydrant',Boolean(waterBoost.nearHydrant)&&charge<100&&!waterBoost.active&&!waterBoost.spraying);
  document.querySelector('#boost-fill').style.width=`${waterBoost.charge}%`;
  document.querySelector('#boost-percent').textContent=`${charge}%`;
  document.querySelector('#boost-status').textContent=waterBoost.spraying?`AUTO HOSE · −${Math.round(waterTuning.projectilesPerSecond*waterTuning.waterPerProjectile)}%/s`
    :waterBoost.active?'WATER BOOST ACTIVE'
    :waterBoost.nearHydrant&&charge<100?`HYDRANT NEARBY · +${waterTuning.hydrantRegen}%/s`
    :waterBoost.needsRelease&&boostHeld?'RELEASE BOOST TO RESTART'
    :hoseTarget&&charge>0?'AUTO SPRAY IN RANGE'
    :boostHeld&&input.throttle<=0?'DRIVE TO BOOST'
    :charge===100?'READY · APPROACH FIRE TO SPRAY'
    :`RECHARGING · +${waterTuning.waterRegen}%/s`;
  boostButton.classList.toggle('active',waterBoost.active||waterBoost.spraying);
  boostButton.classList.toggle('empty',charge===0);
  vehicleSound.update({speed:motion.speed,throttle:input.throttle,braking:motion.braking,handbrake:input.handbrake,boost:waterBoost.active});
  const hydrant=waterBoost.nearHydrant;
  refillRing.visible=Boolean(hydrant)&&charge<100&&!waterBoost.active&&!waterBoost.spraying;
  if(refillRing.visible){
    refillRing.position.set(hydrant.x,getSurfaceHeight(hydrant.x,hydrant.z)+.045,hydrant.z);
    refillRing.scale.setScalar(1+.09*Math.sin(performance.now()*.006));
  }
  const area=player.z>74?'HARBOR WALK':player.z<-195?(player.x<-51?'SUNNY FARM':player.x>52?'MAIL DISTRICT':'NORTH TOWN')
    :player.z<-100?(player.x>52?'WORKSHOP DISTRICT':player.x<-51?'PARKS DISTRICT':'SCHOOL DISTRICT')
      :player.x<-51?'SUBURBS':player.x>52?'INDUSTRIAL YARDS':player.z<5?'DOWNTOWN':player.x>18?'FIRE STATION':'TOWN SQUARE';
  document.querySelector('#district-name').textContent=area;
}
const target=new THREE.Vector3(),desired=new THREE.Vector3();
const hoseNozzle=new THREE.Vector3(),hoseForward=new THREE.Vector3();
let cameraHeading=player.heading;
function updateCamera(dt) {
  sun.position.set(renderPose.x-65,110,renderPose.z+55);
  sun.target.position.set(renderPose.x,0,renderPose.z);
  sun.target.updateMatrixWorld();
  const yawDifference=Math.atan2(Math.sin(renderPose.heading-cameraHeading),Math.cos(renderPose.heading-cameraHeading));
  cameraHeading+=yawDifference*(1-Math.exp(-2.7*dt));
  const angle=cameraHeading+orbit;
  const distance=zoom*Math.cos(pitch),height=zoom*Math.sin(pitch);
  target.set(renderPose.x,2.2,renderPose.z);
  desired.set(renderPose.x-Math.sin(angle)*distance,height+2.2,renderPose.z-Math.cos(angle)*distance);
  camera.position.lerp(desired,1-Math.exp(-7*dt));
  camera.lookAt(target);
  camera.updateMatrixWorld();
}
const fireMarkerLayer=document.querySelector('#fire-markers');
const fireStatus=document.querySelector('#fire-status');
const fireMarkers=new Map();
const markerRight=new THREE.Vector3(),markerForward=new THREE.Vector3();
const missionWaypoint=document.createElement('div');
missionWaypoint.className='mission-waypoint hidden';
missionWaypoint.innerHTML='<span class="arrow" aria-hidden="true">▲</span><span class="waypoint-symbol" aria-hidden="true">!</span><strong></strong>';
fireMarkerLayer.append(missionWaypoint);
const collectWaypoints=new Map();
let lastFireCount=-1;
function clearCollectWaypoints() {
  for (const marker of collectWaypoints.values()) marker.remove();
  collectWaypoints.clear();
}
function waypointLayout(point) {
  const dx=point.x-renderPose.x,dz=point.z-renderPose.z,distance=Math.hypot(dx,dz);
  const layout=edgeMarkerLayout(dx*markerRight.x+dz*markerRight.z,-dx*markerForward.x-dz*markerForward.z,distance,innerWidth,innerHeight);
  layout.x=THREE.MathUtils.clamp(layout.x,78,Math.max(78,innerWidth-78));
  const statusBounds=missionStatus.getBoundingClientRect();
  const minY=Math.min(innerHeight-60,Math.max(90,statusBounds.bottom+48));
  if(layout.y<minY)layout.y=minY;
  return {layout,distance,minY};
}
function positionWaypoint(marker,layout,distance,label) {
  marker.style.left=`${layout.x}px`;marker.style.top=`${layout.y}px`;
  marker.style.setProperty('--marker-scale',layout.scale.toFixed(3));
  marker.style.setProperty('--arrow-angle',`${layout.angle}deg`);
  marker.querySelector('strong').textContent=`${Math.round(distance)}m`;
  marker.setAttribute('aria-label',`${label}, ${Math.round(distance)} metres away`);
}
function updateMissionWaypoint() {
  if (!activeMission || activeMission.type === 'fire') {
    missionWaypoint.classList.add('hidden'); clearCollectWaypoints(); return;
  }
  markerRight.set(1,0,0).applyQuaternion(camera.quaternion);
  markerForward.set(0,0,-1).applyQuaternion(camera.quaternion);
  if (activeMission.type === 'collect' && missionProgress.stage === 'collecting') {
    missionWaypoint.classList.add('hidden');missionWaypoint.classList.remove('returning');
    const remaining=activeMission.pickups.flatMap((point,index)=>missionProgress.collected.has(index)?[]:[{point,index,distance:Math.hypot(point.x-renderPose.x,point.z-renderPose.z)}]);
    remaining.sort((a,b)=>a.distance-b.distance);
    const remainingIds=new Set(remaining.map(item=>item.index));
    for (const [index,marker] of collectWaypoints) if(!remainingIds.has(index)){marker.remove();collectWaypoints.delete(index);}
    const placed=[];
    for (const [order,item] of remaining.entries()) {
      let marker=collectWaypoints.get(item.index);
      if(!marker){marker=missionWaypoint.cloneNode(true);marker.classList.remove('hidden','returning');fireMarkerLayer.append(marker);collectWaypoints.set(item.index,marker);}
      const {layout,distance,minY}=waypointLayout(item.point);
      const original={x:layout.x,y:layout.y};
      const alongX=layout.y<100||layout.y>innerHeight-100;
      for(let attempt=0;attempt<18;attempt++){
        const offset=attempt===0?0:Math.ceil(attempt/2)*(attempt%2?1:-1)*65;
        layout.x=alongX?THREE.MathUtils.clamp(original.x+offset,78,Math.max(78,innerWidth-78)):original.x;
        layout.y=alongX?original.y:THREE.MathUtils.clamp(original.y+offset,minY,innerHeight-60);
        if(placed.every(prior=>Math.hypot(layout.x-prior.x,layout.y-prior.y)>=65))break;
      }
      placed.push({x:layout.x,y:layout.y});
      marker.style.opacity=order===0?'1':'0.5';
      marker.style.zIndex=String(remaining.length-order);
      positionWaypoint(marker,layout,distance,`${activeMission.pickupLabel} ${item.index+1}`);
    }
    return;
  }
  clearCollectWaypoints();
  let point = activeMission.target;
  if (activeMission.type === 'race') point = activeMission.route[missionProgress.checkpoint] ?? point;
  const {layout,distance}=waypointLayout(point);
  missionWaypoint.classList.remove('hidden');
  missionWaypoint.classList.toggle('returning', missionProgress.stage === 'returning');
  missionWaypoint.querySelector('.waypoint-symbol').textContent=missionProgress.stage==='returning'?'↩':'!';
  positionWaypoint(missionWaypoint,layout,distance,activeMission.title);
}
function updateFireMarkers() {
  const activeIds=new Set(fireState.onFire.keys());
  if(activeIds.size!==lastFireCount){
    fireStatus.textContent=activeIds.size?`${activeIds.size} ${activeIds.size===1?'FIRE':'FIRES'} TO PUT OUT`:'ALL FIRES OUT!';
    fireStatus.classList.toggle('clear',activeIds.size===0);
    lastFireCount=activeIds.size;
  }
  for(const [id,marker] of fireMarkers)if(!activeIds.has(id)){marker.remove();fireMarkers.delete(id);}
  markerRight.set(1,0,0).applyQuaternion(camera.quaternion);
  markerForward.set(0,0,-1).applyQuaternion(camera.quaternion);
  const placed=[];
  for(const [id,percent] of fireState.onFire){
    const site=fireSitesById.get(id);
    if(!site)continue;
    let marker=fireMarkers.get(id);
    if(!marker){
      marker=document.createElement('div');marker.className='fire-marker';
      marker.innerHTML='<span class="arrow" aria-hidden="true">▲</span><span class="flame" aria-hidden="true">🔥</span><strong></strong>';
      fireMarkerLayer.append(marker);fireMarkers.set(id,marker);
    }
    const dx=site.x-renderPose.x,dz=site.z-renderPose.z;
    const distance=Math.hypot(dx,dz);
    const layout=edgeMarkerLayout(dx*markerRight.x+dz*markerRight.z,-dx*markerForward.x-dz*markerForward.z,distance,innerWidth,innerHeight);
    for(const prior of placed)if(Math.hypot(layout.x-prior.x,layout.y-prior.y)<105){
      if(Math.abs(layout.x-innerWidth/2)>Math.abs(layout.y-innerHeight/2)){
        const next=prior.y+112;
        layout.y=next<innerHeight-60?next:Math.max(60,prior.y-112);
      }else{
        const next=prior.x+120;
        layout.x=next<innerWidth-65?next:Math.max(65,prior.x-120);
      }
    }
    placed.push(layout);
    marker.style.left=`${layout.x}px`;marker.style.top=`${layout.y}px`;
    marker.style.setProperty('--marker-scale',layout.scale.toFixed(3));
    marker.style.setProperty('--arrow-angle',`${layout.angle}deg`);
    marker.querySelector('strong').textContent=`${percent}%`;
    marker.setAttribute('aria-label',`${site.name} fire, ${percent} percent, ${Math.round(distance)} metres away`);
    marker.classList.toggle('spray-range',Boolean(hoseTarget?.site.worldBuildingId===id&&distance<HOSE_RANGE+site.width));
  }
}
function makeLabels() {
  const wrap=document.querySelector('#world-labels');
  landmarks.forEach(mark=>{const el=document.createElement('div');el.className='world-label';el.style.setProperty('--marker',mark.color);el.innerHTML=`<i></i>${mark.title}`;wrap.append(el);mark.element=el;});
}
function updateLabels() {
  const p=new THREE.Vector3();
  for(const mark of landmarks){
    const dist=Math.hypot(mark.x-player.x,mark.z-player.z);
    if(dist>65){mark.element.style.display='none';continue;}
    p.set(mark.x,mark.y,mark.z).project(camera);
    const visible=p.z<1&&p.z>-1&&Math.abs(p.x)<1&&Math.abs(p.y)<1;
    mark.element.style.display=visible?'flex':'none';
    if(visible){mark.element.style.left=`${(p.x*.5+.5)*innerWidth}px`;mark.element.style.top=`${(-p.y*.5+.5)*innerHeight}px`;mark.element.style.opacity=String(THREE.MathUtils.clamp((75-dist)/25,.5,1));}
  }
}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);
let previous=performance.now();
let simulationTime=0;
function animate(now){
  requestAnimationFrame(animate);
  const elapsedSeconds=Math.max(0,(now-previous)/1000);
  const dt=Math.min(elapsedSeconds,.05);previous=now;
  const simulationRunning=playing&&!panelOpen;
  if(simulationRunning)simulationTime+=dt;
  drive(dt);updateCamera(dt);
  if(simulationRunning){fireState.update(elapsedSeconds);fireEffect.update(dt,camera);}
  if(simulationRunning){advanceMission(dt);updateLabels();updateFireMarkers();updateMissionWaypoint();}
  if(simulationRunning){
    firetruck.updateWorldMatrix(true,false);
    firetruckNozzleWorld(firetruck.userData.model,hoseNozzle);
    hoseForward.set(0,0,1).transformDirection(firetruck.matrixWorld);
    const worldBuildingId=hoseTarget?.site.worldBuildingId;
    const active=worldBuildingId&&fireState.onFire.has(worldBuildingId)&&!waterBoost.active;
    const target=active?{worldBuildingId,windows:fireTargets.get(worldBuildingId)}:null;
    const result=hose.update(dt,hoseNozzle,hoseForward,target,waterBoost,waterTuning);
    waterBoost.spraying=result.spraying;
    hoseEffect.update(result.shots,dt,waterTuning,camera,hoseImpacts,renderer.domElement.height);
    hoseImpacts.length=0;
  }
  if(waterEffect&&simulationRunning)waterEffect.update(waterBoost.active,simulationTime,dt);
  groundMarkers.update(simulationRunning?dt:0,playing?renderPose:null,fireState.onFire,simulationTime);
  missionMarkers.update(simulationTime);
  waterMaterial.color.setHSL(.54,.58,.51+Math.sin(simulationTime*.5)*.01,THREE.SRGBColorSpace);
  renderer.render(scene,camera);
}
camera.position.set(54,21,64);camera.lookAt(25,3,22);
requestAnimationFrame(animate);

preload().then(()=>{
  buildBlocks();fireStation();townHall();museum();school();hospital();square();townLibrary();sportsCenter();
  industrialFootbridge();industrialFootbridge(85,-151,'INDUSTRIAL FOOTBRIDGE');industrialFootbridge(125,-151,'CANAL GATE');
  details();createTruck();makeLabels();
  document.querySelector('#loading').classList.add('hidden');
  document.querySelector('#menu').classList.remove('hidden');
}).catch(error=>{
  console.error(error);
  document.querySelector('#loading-copy').textContent=`Could not load the town: ${error.message}`;
});
