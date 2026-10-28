import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BUILDING_TYPES, BUILDING_TYPES_BY_ID } from './building-catalog.js';
import WINDOW_MAP from './building-windows.json';
import { INDUSTRIAL_CHIMNEYS } from './industrial-chimneys.js';
import { createBuildingFireState } from './building-fire.js';
import { createBuildingFireEffect } from './building-fire-effect.js';
import { createFirefightingEffect } from './firefighting-effect.js';
import { createFirefightingProgress, HOSE_RANGE, nearestBurningBuilding } from './firefighting.js';
import { firetruckNozzleWorld } from './firetruck-nozzle.js';
import { createHoseProjectiles } from './hose-projectiles.js';
import { nearestWindowTarget, worldWindowTargets } from './window-targets.js';
import { createWaterBoostState, stepWaterBoost } from './water-boost.js';
import { WATER_TUNING_DEFAULTS, loadWaterTuning, saveWaterTuning } from './water-tuning-config.js';
import './watertuning.css';

const $ = id => document.getElementById(id);
const numericKeys = ['projectilesPerSecond','extinguishPerProjectile','waterPerProjectile','lobAngle','lobSpeed',
  'waterRegen','projectileSize','trailAmount','trailSpread','trailSpeed','trailGravity','streamTrailDuration'];
let settings = loadWaterTuning();
function fillSettings() {
  for (const key of numericKeys) $(key).value = settings[key];
  $('waterColor').value = settings.waterColor;
  $('lastParticleOnly').checked = settings.lastParticleOnly;
}
fillSettings();
for (const key of numericKeys) $(key).addEventListener('change', () => {
  settings = saveWaterTuning({ ...settings, [key]: Number($(key).value) });
  $(key).value = settings[key];
});
$('waterColor').addEventListener('input', () => { settings = saveWaterTuning({ ...settings, waterColor: $('waterColor').value }); });
$('lastParticleOnly').addEventListener('change', () => { settings = saveWaterTuning({ ...settings, lastParticleOnly: $('lastParticleOnly').checked }); });
$('reset').addEventListener('click', () => { settings = saveWaterTuning(WATER_TUNING_DEFAULTS); fillSettings(); });
$('building-options').innerHTML = BUILDING_TYPES.map(type => `<option value="${type.id}" label="${type.name}"></option>`).join('');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#b6e3ef');
scene.add(new THREE.HemisphereLight('#ffffff','#7899a4',2.5));
const sun = new THREE.DirectionalLight('#fff2d3',2.4);
sun.position.set(-15,25,18);scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(300,300),new THREE.MeshLambertMaterial({color:'#d3dfbc'}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.06;scene.add(ground);
const lane = new THREE.Mesh(new THREE.PlaneGeometry(300,7),new THREE.MeshLambertMaterial({color:'#708e9e'}));
lane.rotation.x=-Math.PI/2;lane.position.set(0,-.045,3);scene.add(lane);
const loader = new GLTFLoader(), cache = new Map();
async function source(path) {
  if (!cache.has(path)) cache.set(path,loader.loadAsync(`${import.meta.env.BASE_URL}assets/${path}.glb`).then(gltf=>gltf.scene));
  return cache.get(path);
}
const renderer = new THREE.WebGLRenderer({canvas:$('preview-canvas'),antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.3;
const camera = new THREE.PerspectiveCamera(42,2,.1,400);
const fireState = createBuildingFireState([{worldBuildingId:'PREVIEW'}],()=>1);
const fireProgress = createFirefightingProgress(fireState);
const tank = createWaterBoostState();
const hoseEffect = createFirefightingEffect(THREE,scene);
const impacts = [];
let hitCount=0, building=null, truck=null, windows=[], fireEffect=null, fireNodes=[], currentType=null, loadingSerial=0, previewSite=null;
const hose = createHoseProjectiles(THREE,(id,windowId,point,reduction)=>{
  if (fireState.onFire.has(id)) {
    fireProgress.apply(id,reduction);
    impacts.push(point.clone());
    hitCount++;
    $('preview-status').textContent=`HIT ${windowId}`;
  }
});

const targetGeometry = new THREE.BufferGeometry();
const targetOutline = new THREE.LineLoop(targetGeometry,new THREE.LineBasicMaterial({color:'#00deff',depthTest:false,transparent:true,opacity:.85}));
targetOutline.renderOrder=12;scene.add(targetOutline);
const nozzle = new THREE.Vector3(), forward = new THREE.Vector3();
let distance=Number($('distance').value);
function positionScene() {
  if (!building || !truck) return;
  const box=new THREE.Box3().setFromObject(building);
  const center=box.getCenter(new THREE.Vector3());
  building.position.x+=distance/2-center.x;
  building.position.z-=center.z;
  building.position.y-=box.min.y;
  truck.position.set(-distance/2,0,3);
  truck.rotation.y=Math.PI/2;
  building.updateWorldMatrix(true,true);
  windows=worldWindowTargets(THREE,building,WINDOW_MAP[currentType.path]??[]);
  const bounds=new THREE.Box3().setFromObject(building);
  const resized=bounds.getSize(new THREE.Vector3());
  previewSite={worldBuildingId:'PREVIEW',x:(bounds.min.x+bounds.max.x)/2,z:(bounds.min.z+bounds.max.z)/2,width:resized.x,depth:resized.z};
  const span=Math.max(28,distance+resized.x+10);
  const height=Math.max(12,resized.y+5);
  const viewport=$('preview-canvas').getBoundingClientRect();
  const aspect=Math.max(.6,viewport.width/Math.max(1,viewport.height));
  const z=Math.max(span/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*aspect),height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)))*1.2;
  camera.position.set(-span*.12,Math.max(11,resized.y*.6+7),z);
  camera.lookAt(0,resized.y*.35,0);
  camera.updateMatrixWorld();
  rebuildFireEffect();
  hose.reset();hoseEffect.reset();
}
function rebuildFireEffect() {
  for (const node of fireNodes) { scene.remove(node);node.geometry?.dispose();node.material?.dispose(); }
  fireNodes=[];
  const before=new Set(scene.children);
  fireEffect=createBuildingFireEffect(THREE,scene,fireState);
  fireNodes=scene.children.filter(node=>!before.has(node));
  const sourceBox=new THREE.Box3().setFromObject(cacheSource);
  fireEffect.registerBuilding('PREVIEW',building,WINDOW_MAP[currentType.path]??[],sourceBox.min.y,sourceBox.max.y,INDUSTRIAL_CHIMNEYS[currentType.path]??[]);
}
let cacheSource=null;
async function loadBuilding(id) {
  const type=BUILDING_TYPES_BY_ID.get(id.toUpperCase());
  if (!type) { $('preview-status').textContent='Unknown building ID'; return; }
  const serial=++loadingSerial;
  $('preview-status').textContent='Loading model…';
  try {
    const original=await source(type.path);
    if (serial!==loadingSerial) return;
    if (building) scene.remove(building);
    cacheSource=original;
    building=original.clone(true);
    building.scale.setScalar(type.group==='small'?6.6:type.group==='large'?8.5:8.2);
    scene.add(building);
    currentType=type;
    $('building-id').value=type.id;
    $('model-label').textContent=`${type.id} · ${type.name}`;
    const url=new URL(location.href);url.searchParams.set('type',type.id);history.replaceState(null,'',url);
    positionScene();
    $('preview-status').textContent=windows.length?`${windows.length} mapped windows`:'No mapped windows · shots cannot extinguish';
  } catch (error) { console.error(error);$('preview-status').textContent='Could not load model'; }
}

async function setup() {
  try {
    const original=await source('cars/firetruck');
    truck=original.clone(true);truck.scale.setScalar(1.75);scene.add(truck);
    await loadBuilding(new URLSearchParams(location.search).get('type') ?? 'B1-05');
  } catch (error) { console.error(error);$('preview-status').textContent='Could not load preview'; }
}
setup();

$('building-id').addEventListener('change',()=>loadBuilding($('building-id').value.trim()));
$('distance').addEventListener('input',()=>{
  distance=Number($('distance').value);$('distance-output').value=`${distance} m`;
  if (building) positionScene();
});
$('distance-output').value=`${distance} m`;
const fireSlider=$('fire-percent');
fireSlider.addEventListener('input',()=>{
  fireState.set('PREVIEW',Number(fireSlider.value));
  $('fire-output').value=`${fireSlider.value}%`;
});
fireState.set('PREVIEW',Number(fireSlider.value));
$('hydrant').addEventListener('change',()=>{
  $('hydrant').parentElement.querySelector('small').textContent=`+${settings.hydrantRegen}% water per second`;
});
$('refill').addEventListener('click',()=>{tank.charge=100;});

function resize() {
  const rect=$('preview-canvas').getBoundingClientRect();
  renderer.setSize(rect.width,rect.height,false);
  camera.aspect=rect.width/Math.max(1,rect.height);camera.updateProjectionMatrix();
  if (building) positionScene();
}
new ResizeObserver(resize).observe($('preview-canvas'));
let previous=performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;
  if (truck && building) {
    const hydrants=$('hydrant').checked?[{x:truck.position.x,z:truck.position.z}]:[];
    stepWaterBoost(tank,truck.position,{},dt,hydrants,{normal:settings.waterRegen,hydrant:settings.hydrantRegen});
    truck.updateWorldMatrix(true,false);
    firetruckNozzleWorld(truck,nozzle);
    forward.set(0,0,1).transformDirection(truck.matrixWorld);
    const inRange=previewSite&&nearestBurningBuilding(truck.position,[previewSite],fireState.onFire);
    const target=inRange?{worldBuildingId:'PREVIEW',windows}:null;
    const result=hose.update(dt,nozzle,forward,target,tank,settings);
    tank.spraying=result.spraying;
    hoseEffect.update(result.shots,dt,settings,camera,impacts,renderer.domElement.height);impacts.length=0;
    fireEffect?.update(dt,camera);
    const nearest=target?nearestWindowTarget(nozzle,windows):null;
    targetOutline.visible=Boolean(nearest);
    if (nearest) {
      targetGeometry.setFromPoints(nearest.corners.map(point=>point.clone().addScaledVector(nearest.normal,.08)));
      if (!result.spraying && fireState.onFire.has('PREVIEW')) $('preview-status').textContent=`TARGET ${nearest.id}`;
    }
    const percent=fireState.onFire.get('PREVIEW')??0;
    $('water-value').textContent=`${Math.round(tank.charge)}% water`;
    $('fire-value').textContent=`${percent}%`;
    $('hit-value').textContent=String(hitCount);
    if (document.activeElement!==fireSlider) fireSlider.value=percent;
    $('fire-output').value=`${percent}%`;
    if (!percent) $('preview-status').textContent='FIRE OUT · raise slider to relight';
    else if (!inRange) $('preview-status').textContent=`OUT OF RANGE · move within ${HOSE_RANGE} m`;
    else if (/^(OUT OF RANGE|FIRE OUT)/.test($('preview-status').textContent)) $('preview-status').textContent=`${windows.length} mapped windows`;
  }
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);
