import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';
import { FIRETRUCK, VEHICLE_STEP, createVehicleState, vehicleMotion, wheelContacts } from './vehicle-physics.js';
import { AVENUE_X, ROAD_Y, HYDRANT_LOCATIONS, SHORE_BARRIERS, buildWorldSurfaces, getSurfaceHeight, surfaceAt, isReserved } from './world-layout.js';
import { BUILDING_SITES } from './city-plan.js';
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

const canvas = document.querySelector('#world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;

const scene = new THREE.Scene();
const fireState = createBuildingFireState(BUILDING_SITES);
const fireEffect = createBuildingFireEffect(THREE, scene, fireState);
// Scenario scripts can ignite a placed building by its world ID. For a quick
// preview, open the game with ?fire=WB-001:75 (repeat `fire` for more sites).
for (const entry of new URLSearchParams(location.search).getAll('fire')) {
  const [id, percent] = entry.split(':');
  if (BUILDING_SITES.some(site => site.worldBuildingId === id)) fireState.set(id, percent);
}
window.buildingFires = { onFire: fireState.onFire, set: fireState.set, sites: BUILDING_SITES };
scene.background = new THREE.Color('#b8e7fa');
scene.fog = new THREE.Fog('#b8e7fa', 145, 325);
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, .5, 400);
const hemi = new THREE.HemisphereLight('#ffffff', '#a6b784', 2.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff0ce', 2.3);
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
  commercial: ['building-a','building-b','building-c','building-d','building-e','building-f','building-g','building-h','building-i','building-j','building-k','building-l','building-skyscraper-b','building-skyscraper-d','building-skyscraper-e'],
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
  if(site.worldBuildingId)fireEffect.registerBuilding(site.worldBuildingId,item,WINDOW_MAP[`${pack}/${name}`]??[],sourceBounds.min.y,sourceBounds.max.y,INDUSTRIAL_CHIMNEYS[`${pack}/${name}`]??[]);
  return item;
}
function buildBlocks() {
  BUILDING_SITES.forEach(building);
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
  firetruck.userData.wheels=[];
  truckModel.traverse(node=>{if(node.name.startsWith('wheel-'))firetruck.userData.wheels.push(node);});
  truckModel.traverse(node => { if(node.isMesh) node.castShadow = true; });
  const blueLight = new THREE.PointLight('#88d9ff', 0, 8);
  blueLight.position.set(0, 2.9, -.15); firetruck.add(blueLight);
  firetruck.userData.blueLight = blueLight;
  waterEffect = createWaterEffect(THREE, scene, firetruck, getSurfaceHeight, surfaceAt);
  firetruck.position.set(player.x,ROAD_Y,player.z);
  firetruck.rotation.y=player.heading;
}

const player = createVehicleState({x:35,z:38,heading:-Math.PI/2});
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
function resetInput() {keys.clear();touchControls.reset();releaseBoost();releaseCamera();previousWheels=null;physicsAccumulator=0;waterBoost.active=false;refillRing.visible=false;boostButton.classList.remove('active');vehicleSound.pause();}
window.addEventListener('keydown',e=>{
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
document.querySelector('#start-button').addEventListener('click',()=>{resetInput();playing=true;vehicleSound.start();document.querySelector('#menu').classList.add('hidden');document.querySelector('#hud').classList.remove('hidden');canvas.style.cursor='grab';});
document.querySelector('#menu-button').addEventListener('click',()=>{playing=false;resetInput();document.querySelector('#menu').classList.remove('hidden');document.querySelector('#hud').classList.add('hidden');});

function drive(dt) {
  if(!playing||!firetruck){physicsAccumulator=0;return;}
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
    const boost=boostHeld&&input.throttle>0&&waterBoost.charge>0&&!waterBoost.needsRelease;
    motion=advanceVehicle(player,{...input,boost},VEHICLE_STEP,solids);
    stepWaterBoost(waterBoost,player,{held:boostHeld&&!motion.blocked,throttle:input.throttle},VEHICLE_STEP);
    if(motion.blocked)previousWheels=null;
    updateSkids(input.handbrake,motion.speed);
    physicsAccumulator-=VEHICLE_STEP;
  }
  const groundHeight=Math.max(...[...wheelContacts(player),...wheelContacts(player,'front')].map(p=>getSurfaceHeight(p.x,p.z)));
  firetruck.position.set(player.x,groundHeight,player.z);
  firetruck.rotation.y=player.heading;
  for(const wheel of firetruck.userData.wheels){
    wheel.rotation.x=player.wheelSpin;
    if(wheel.name.includes('front'))wheel.rotation.y=-player.steeringAngle;
  }
  firetruck.userData.blueLight.intensity=.7+.7*Math.sin(performance.now()*.013)**8;
  document.querySelector('#speed-value').textContent=String(Math.round(motion.speed*3.6)).padStart(2,'0');
  document.querySelector('#drift-indicator').classList.toggle('active',input.handbrake&&motion.speed>3);
  const charge=Math.round(waterBoost.charge);
  const meter=document.querySelector('#water-meter');
  meter.setAttribute('aria-valuenow',String(charge));
  meter.classList.toggle('near-hydrant',Boolean(waterBoost.nearHydrant)&&charge<100&&!waterBoost.active);
  document.querySelector('#boost-fill').style.width=`${waterBoost.charge}%`;
  document.querySelector('#boost-percent').textContent=`${charge}%`;
  document.querySelector('#boost-status').textContent=waterBoost.active?'WATER JET ACTIVE'
    :waterBoost.nearHydrant&&charge<100?'HYDRANT NEARBY · +25%/s'
    :waterBoost.needsRelease&&boostHeld?'RELEASE BOOST TO RESTART'
    :boostHeld&&input.throttle<=0?'DRIVE TO USE BOOST'
    :charge===100?(document.body.classList.contains('has-touch-controls')?'READY · DRIVE + BOOST':'READY · HOLD SHIFT OR BOOST')
    :'RECHARGING · +1%/s';
  boostButton.classList.toggle('active',waterBoost.active);
  boostButton.classList.toggle('empty',charge===0);
  vehicleSound.update({speed:motion.speed,throttle:input.throttle,braking:motion.braking,handbrake:input.handbrake,boost:waterBoost.active});
  const hydrant=waterBoost.nearHydrant;
  refillRing.visible=Boolean(hydrant)&&charge<100&&!waterBoost.active;
  if(refillRing.visible){
    refillRing.position.set(hydrant.x,getSurfaceHeight(hydrant.x,hydrant.z)+.045,hydrant.z);
    refillRing.scale.setScalar(1+.09*Math.sin(performance.now()*.006));
  }
  const area=player.z>74?'HARBOR WALK':player.x<-51?'SUBURBS':player.x>52?'INDUSTRIAL YARDS':player.z<5?'DOWNTOWN':player.x>18?'FIRE STATION':'TOWN SQUARE';
  document.querySelector('#district-name').textContent=area;
}
const target=new THREE.Vector3(),desired=new THREE.Vector3();
let cameraHeading=player.heading;
function updateCamera(dt) {
  const yawDifference=Math.atan2(Math.sin(player.heading-cameraHeading),Math.cos(player.heading-cameraHeading));
  cameraHeading+=yawDifference*(1-Math.exp(-2.7*dt));
  const angle=cameraHeading+orbit;
  const distance=zoom*Math.cos(pitch),height=zoom*Math.sin(pitch);
  target.set(player.x,2.2,player.z);
  desired.set(player.x-Math.sin(angle)*distance,height+2.2,player.z-Math.cos(angle)*distance);
  camera.position.lerp(desired,1-Math.exp(-7*dt));
  camera.lookAt(target);
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
function animate(now){
  requestAnimationFrame(animate);
  const elapsedSeconds=Math.max(0,(now-previous)/1000);
  const dt=Math.min(elapsedSeconds,.05);previous=now;
  drive(dt);updateCamera(dt);
  if(playing){fireState.update(elapsedSeconds);fireEffect.update(dt,camera);}
  if(playing)updateLabels();
  if(waterEffect)waterEffect.update(playing&&waterBoost.active,now/1000,dt);
  waterMaterial.color.setHSL(.54,.58,.51+Math.sin(now*.0005)*.01,THREE.SRGBColorSpace);
  renderer.render(scene,camera);
}
camera.position.set(54,21,64);camera.lookAt(25,3,22);
requestAnimationFrame(animate);

preload().then(()=>{
  buildBlocks();fireStation();townHall();museum();school();hospital();square();details();createTruck();makeLabels();
  document.querySelector('#loading').classList.add('hidden');
  document.querySelector('#menu').classList.remove('hidden');
}).catch(error=>{
  console.error(error);
  document.querySelector('#loading-copy').textContent=`Could not load the town: ${error.message}`;
});
