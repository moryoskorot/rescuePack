import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BUILDING_TYPES, BUILDING_TYPES_BY_ID } from './building-catalog.js';
import WINDOW_MAP from './building-windows.json';
import { windowThird } from './building-fire.js';
import { createBuildingFirePreview } from './building-fire-preview.js';
import './buildingsheet.css';

document.title = 'Building Sheet — Rescue Pack';
document.body.innerHTML = `
  <main class="sheet">
    <header class="sheet-header">
      <div><a class="back" href="${import.meta.env.BASE_URL}">← City Drive</a><p class="eyebrow">MODEL REFERENCE</p><h1>Building sheet</h1>
        <p>Building IDs belong to model types, independent of their positions on the map. Red outlines mark individual windows.</p></div>
      <div class="sheet-count"><strong>${BUILDING_TYPES.length}</strong><span>building types · ${Object.values(WINDOW_MAP).reduce((sum, items) => sum + items.length, 0)} windows</span></div>
    </header>
    <div class="sheet-toolbar"><label>Find a building <input id="building-search" type="search" placeholder="ID or model name" autocomplete="off"></label>
      <span id="loading-status" role="status">Loading models…</span></div>
    <div class="sheet-layout"><nav id="building-list" aria-label="Building types"></nav><section id="building-detail" aria-live="polite"></section></div>
  </main>`;

const list = document.querySelector('#building-list');
const detail = document.querySelector('#building-detail');
const cache = new Map();
const loader = new GLTFLoader();
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#dceaf0');
scene.add(new THREE.HemisphereLight(0xffffff, 0x9fa7ae, 2.4));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-3, 7, 6);
scene.add(sun);
const camera = new THREE.OrthographicCamera();
let selected = BUILDING_TYPES_BY_ID.get(new URLSearchParams(location.search).get('type')) ?? BUILDING_TYPES[0];
let firePercent = 0;
let firePreview = null;

async function getModel(type) {
  if (!cache.has(type.path)) {
    const url = `${import.meta.env.BASE_URL}assets/${type.path}.glb`;
    cache.set(type.path, loader.loadAsync(url).then(gltf => gltf.scene));
  }
  return cache.get(type.path);
}

function renderModel(object, direction, width, height, modelBounds = null) {
  const model = object.clone(true);
  scene.add(model);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.length(), 1);
  const dir = direction.clone().normalize();
  camera.position.copy(center).addScaledVector(dir, radius * 3);
  camera.lookAt(center);
  const horizontal = Math.abs(dir.x) > .1 && Math.abs(dir.z) > .1 ?
    (size.x + size.z) / Math.SQRT2 : dir.x === 0 ? size.x : size.z;
  const vertical = size.y + (Math.abs(dir.y) > .1 ? horizontal * .36 : 0);
  const aspect = width / height;
  const spanY = Math.max(vertical * 1.22, horizontal / aspect * 1.22, .6);
  camera.left = -spanY * aspect / 2;
  camera.right = spanY * aspect / 2;
  camera.top = spanY / 2;
  camera.bottom = -spanY / 2;
  camera.near = .01;
  camera.far = radius * 8;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  renderer.setSize(width, height, false);
  renderer.render(scene, camera);
  const image = renderer.domElement.toDataURL('image/png');
  const windows = WINDOW_MAP[object.userData?.path] || [];
  const fireAnchors = [];
  const overlay = windows.flatMap(window => {
    if (window.side !== direction.userData?.side) return [];
    const points = window.corners.map(p => new THREE.Vector3(...p).project(camera));
    const xs = points.map(p => (p.x + 1) * width / 2);
    const ys = points.map(p => (1 - p.y) * height / 2);
    const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
    if (modelBounds) fireAnchors.push({
      x: x + w / 2, y: y + h / 2, width: w, height: h,
      third: windowThird(window.center[1], modelBounds.min.y, modelBounds.max.y),
    });
    const number = window.id.split('-W')[1];
    const label = w > 24 && h > 17 ? `<text x="${x + 2}" y="${Math.max(13, y - 3)}">${number}</text>` : '';
    return `<g data-window-id="${window.id}"><title>${window.id}</title><rect x="${x}" y="${y}" width="${w}" height="${h}"/>${label}</g>`;
  }).join('');
  scene.remove(model);
  return { image, overlay, fireAnchors };
}

const views = [
  ['+Z face', '+Z', new THREE.Vector3(0, 0, 1)],
  ['+X face', '+X', new THREE.Vector3(1, 0, 0)],
  ['−Z face', '-Z', new THREE.Vector3(0, 0, -1)],
  ['−X face', '-X', new THREE.Vector3(-1, 0, 0)],
];
for (const [, side, vector] of views) vector.userData = { side };

function populateList() {
  let current = '';
  for (const type of BUILDING_TYPES) {
    if (type.group !== current) {
      current = type.group;
      const heading = document.createElement('h2');
      heading.textContent = `${current} buildings`;
      list.append(heading);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'building-item';
    button.dataset.path = type.path;
    button.dataset.search = `${type.id} ${type.index} ${type.name} ${type.group}`.toLowerCase();
    button.innerHTML = `<span class="building-thumb" aria-hidden="true"></span><span class="building-id">${type.id}</span><span class="building-name">${type.name}</span><small>${WINDOW_MAP[type.path]?.length ?? 0} windows</small>`;
    button.addEventListener('click', () => select(type, true));
    list.append(button);
    thumbnailObserver.observe(button);
  }
}

const thumbnailObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    thumbnailObserver.unobserve(entry.target);
    const type = BUILDING_TYPES.find(item => item.path === entry.target.dataset.path);
    getModel(type).then(object => {
      object.userData.path = type.path;
      const sideCounts = new Map();
      for (const window of WINDOW_MAP[type.path] ?? []) sideCounts.set(window.side, (sideCounts.get(window.side) ?? 0) + 1);
      const side = [...sideCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '+Z';
      const direction = views.find(view => view[1] === side)[2];
      const { image, overlay } = renderModel(object, direction, 300, 240);
      entry.target.querySelector('.building-thumb').innerHTML = `<img src="${image}" alt=""><svg viewBox="0 0 300 240" aria-hidden="true">${overlay}</svg><span class="thumb-face">${side} face</span>`;
    }).catch(() => { entry.target.querySelector('.building-thumb').textContent = '×'; });
  }
}, { rootMargin: '400px' });

async function select(type, scrollToDetail = false) {
  selected = type;
  firePreview?.stop();
  firePreview = null;
  const url = new URL(location.href);
  url.searchParams.set('type', type.id);
  history.replaceState(null, '', url);
  list.querySelectorAll('.building-item').forEach(button => button.classList.toggle('active', button.dataset.path === type.path));
  detail.innerHTML = `<p class="loading-detail">Loading ${type.name}…</p>`;
  try {
    const object = await getModel(type);
    if (selected !== type) return;
    object.userData.path = type.path;
    const windows = WINDOW_MAP[type.path] ?? [];
    const count = windows.length;
    if (!count) firePercent = 0;
    const modelBounds = new THREE.Box3().setFromObject(object);
    const shots = views.map(([label, side, direction]) => {
      const { image, overlay, fireAnchors } = renderModel(object, direction, 600, 480, modelBounds);
      return {
        fireAnchors,
        markup: `<figure class="elevation"><div class="elevation-image"><img src="${image}" alt="${label} view of ${type.name}">
          <canvas class="fire-preview" width="600" height="480" aria-hidden="true"></canvas>
          <svg viewBox="0 0 600 480" aria-label="Window outlines, ${label} view">${overlay}</svg></div><figcaption>${label} <span>${side}</span></figcaption></figure>`,
      };
    });
    const windowList = windows.map(window => `<button class="window-entry" data-window-id="${window.id}" type="button"><strong>${window.id}</strong><span>${window.side} · ${window.center.map(v => v.toFixed(2)).join(', ')}</span></button>`).join('');
    detail.innerHTML = `<div class="detail-heading"><div><span class="eyebrow">${type.group.toUpperCase()} · TYPE ${type.index}</span><h2>${type.name}</h2><code>${type.id}</code></div>
      <p>${count} window${count === 1 ? '' : 's'} mapped</p></div>
      <div class="fire-controls"><button id="fire-simulate" type="button" ${count ? '' : 'disabled'}>Simulate fire</button>
        <label for="fire-percent">Fire level <input id="fire-percent" type="range" min="0" max="100" value="${firePercent}" ${count ? '' : 'disabled'}></label>
        <output id="fire-percent-value" for="fire-percent">${firePercent}%</output></div>
      <p class="fire-hint">${count ? 'Preview for this model type. Map fires use separate world building IDs.' : 'This low-detail model has no mapped windows, so there are no window fire emitters.'}</p>
      <div class="elevation-grid">${shots.map(shot => shot.markup).join('')}</div>
      <section class="window-index"><h3>Window index <small>Model local X, Y, Z coordinates</small></h3><div class="window-entries">${windowList}</div></section>`;
    firePreview = createBuildingFirePreview(shots.map((shot, index) => ({
      canvas: detail.querySelectorAll('.fire-preview')[index], anchors: shot.fireAnchors,
    })));
    const fireButton = detail.querySelector('#fire-simulate');
    const fireSlider = detail.querySelector('#fire-percent');
    const fireValue = detail.querySelector('#fire-percent-value');
    function setPreviewFire(value) {
      firePercent = Number(value);
      fireSlider.value = String(firePercent);
      fireValue.value = `${firePercent}%`;
      fireButton.textContent = firePercent ? 'Clear fire' : 'Simulate fire';
      firePreview.setPercent(firePercent);
    }
    fireButton.addEventListener('click', () => setPreviewFire(firePercent ? 0 : 50));
    fireSlider.addEventListener('input', () => setPreviewFire(fireSlider.value));
    setPreviewFire(firePercent);
    function highlightWindow(id, scrollToView) {
      detail.querySelectorAll('.window-entry, .elevation svg g').forEach(item => item.classList.toggle('highlighted', item.dataset.windowId === id));
      const outline = [...detail.querySelectorAll('.elevation svg g')].find(item => item.dataset.windowId === id);
      if (scrollToView) outline?.closest('.elevation')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    detail.querySelectorAll('.window-entry').forEach(button => button.addEventListener('click', () => highlightWindow(button.dataset.windowId, true)));
    detail.querySelectorAll('.elevation svg g').forEach(group => group.addEventListener('click', () => highlightWindow(group.dataset.windowId, false)));
    if (scrollToDetail) detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    detail.textContent = `Could not load ${type.path}: ${error.message}`;
  }
}

populateList();
select(selected);
document.querySelector('#building-search').addEventListener('input', event => {
  const query = event.target.value.trim().toLowerCase();
  list.querySelectorAll('.building-item').forEach(button => { button.hidden = !button.dataset.search.includes(query); });
});
document.querySelector('#loading-status').textContent = 'Choose a model to inspect its four faces';
