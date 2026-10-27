import { windowFireStrength, windowThird } from './building-fire.js';
import { chimneyFireStrength } from './industrial-chimneys.js';

const WINDOW_FLAME_RATE = [0, 3.4, 5.0, 7.2];
const WINDOW_SMOKE_RATE = [1.8, 1.3, 2.0, 3.2];
const CHIMNEY_FLAME_RATE = [0, 0, 5.0, 0];
const CHIMNEY_SMOKE_RATE = [3.2, 0, 2.5, 0];

// A pair of dynamic point clouds keeps the visual cost bounded even when many
// windows burn. Particle positions are calculated from each placed GLB's own
// local window map; the same source model can burn at several world sites.
export function createBuildingFireEffect(THREE, scene, fireState) {
  const emitters = [];
  const particles = { flame: [], smoke: [] };
  const capacities = { flame: 750, smoke: 900 };
  const pointClouds = {};
  const pointData = {};
  const uniforms = { uProjectionScale: { value: 800 } };
  const vertexShader = `
    attribute float aSize;
    attribute float aAlpha;
    attribute vec3 aColor;
    attribute float aRotation;
    uniform float uProjectionScale;
    varying vec4 vColor;
    varying float vRotation;
    void main() {
      vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * viewPosition;
      gl_PointSize = clamp(aSize * uProjectionScale / max(1.0, -viewPosition.z), 1.0, 110.0);
      vColor = vec4(aColor, aAlpha);
      vRotation = aRotation;
    }
  `;
  const flameShader = `
    varying vec4 vColor;
    varying float vRotation;
    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float c = cos(vRotation), s = sin(vRotation);
      vec2 turned = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
      float square = max(abs(turned.x), abs(turned.y));
      float block = 1.0 - step(0.39, square);
      gl_FragColor = vec4(vColor.rgb, vColor.a * block);
    }
  `;
  const smokeShader = `
    varying vec4 vColor;
    varying float vRotation;
    void main() {
      vec2 uv = (gl_PointCoord - 0.5) * 2.0;
      float c = cos(vRotation), s = sin(vRotation);
      vec2 turned = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
      vec2 edge = abs(turned);
      float octagon = max(max(edge.x, edge.y), (edge.x + edge.y) * 0.72);
      float puff = 1.0 - step(0.76, octagon);
      float core = 1.0 - step(0.42, octagon);
      gl_FragColor = vec4(vColor.rgb, vColor.a * puff * (0.62 + core * 0.38));
    }
  `;
  for (const kind of ['flame', 'smoke']) {
    const capacity = capacities[kind];
    const positions = new Float32Array(capacity * 3);
    const sizes = new Float32Array(capacity);
    const alphas = new Float32Array(capacity);
    const colors = new Float32Array(capacity * 3);
    const rotations = new Float32Array(capacity);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aRotation', new THREE.BufferAttribute(rotations, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    const material = new THREE.ShaderMaterial({
      uniforms, vertexShader, fragmentShader: kind === 'flame' ? flameShader : smokeShader, transparent: true,
      depthWrite: false, depthTest: true,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = kind === 'flame' ? 6 : 5;
    scene.add(points);
    pointClouds[kind] = points;
    pointData[kind] = { positions, sizes, alphas, colors, rotations };
  }

  const local = new THREE.Vector3();
  const outward = new THREE.Vector3();
  const sideways = new THREE.Vector3();
  function registerBuilding(worldBuildingId, object, windows, modelMinY, modelMaxY, chimneys = []) {
    object.updateWorldMatrix(true, true);
    for (const window of windows) {
      const normal = window.side === '+X' ? [1, 0, 0] : window.side === '-X' ? [-1, 0, 0]
        : window.side === '+Z' ? [0, 0, 1] : [0, 0, -1];
      local.fromArray(window.center);
      const center = object.localToWorld(local).clone();
      outward.fromArray(normal).transformDirection(object.matrixWorld);
      sideways.set(window.side.endsWith('Z') ? 1 : 0, 0, window.side.endsWith('X') ? 1 : 0)
        .transformDirection(object.matrixWorld);
      const width = window.width * object.scale.x;
      const height = window.height * object.scale.y;
      emitters.push({
        worldBuildingId,
        center,
        outward: outward.clone(),
        sideways: sideways.clone(),
        width, height,
        mass: Math.max(.6, Math.min(5.5, Math.pow(width * height / 1.6, .7))),
        third: windowThird(window.center[1], modelMinY, modelMaxY),
        chimney: false,
        flameLane: 0,
        flameCarry: Math.random(),
        smokeCarry: Math.random(),
      });
    }
    for (const chimney of chimneys) {
      local.fromArray(chimney.center);
      const center = object.localToWorld(local).clone();
      const width = chimney.diameter * object.scale.x;
      emitters.push({
        worldBuildingId, center, chimney: true,
        sideways: new THREE.Vector3(1, 0, 0).transformDirection(object.matrixWorld),
        outward: new THREE.Vector3(0, 0, 1).transformDirection(object.matrixWorld),
        width,
        height: chimney.diameter * object.scale.y,
        mass: Math.max(1, Math.min(2.3, width * 1.3)),
        flameLane: 0, flameCarry: Math.random(), smokeCarry: Math.random(),
      });
    }
  }

  function spawn(kind, emitter, strength) {
    const list = particles[kind];
    if (list.length >= capacities[kind]) return;
    const r = Math.random;
    const lanes = Math.max(1, Math.min(9, Math.ceil(emitter.width / .75)));
    const lane = kind === 'flame' ? emitter.flameLane++ % lanes : 0;
    const offset = emitter.chimney ? (r() - .5) * emitter.width * .65
      : kind === 'flame' ? ((lane + .15 + r() * .7) / lanes - .5) * emitter.width * .96
        : (r() - .5) * emitter.width * .96;
    const up = emitter.chimney ? .06 : (r() - .5) * emitter.height * .78
      + (kind === 'smoke' ? emitter.height * .2 : 0);
    const sizeFactor = emitter.chimney ? Math.max(.65, Math.min(1.25, emitter.width))
      : Math.max(.7, Math.min(1.55, Math.sqrt(emitter.width * emitter.height) / 1.5));
    const flame = kind === 'flame';
    const ember = flame && r() < .14;
    const life = flame ? [.0, .4, .72, 1.05][strength] + r() * [.0, .25, .43, .65][strength]
      : 1.35 + r() * (strength === 3 ? 1.6 : 1.0);
    const size = (flame ? (.25 + strength * .17) * (ember ? .34 : 1) : .8 + strength * .18)
      * sizeFactor * (.7 + r() * .65);
    const origin = emitter.center;
    list.push({
      x: origin.x + emitter.sideways.x * offset + emitter.outward.x * (emitter.chimney ? (r() - .5) * emitter.width * .65 : .2),
      y: origin.y + up,
      z: origin.z + emitter.sideways.z * offset + emitter.outward.z * (emitter.chimney ? (r() - .5) * emitter.width * .65 : .2),
      vx: emitter.outward.x * (.25 + r() * .38) + (r() - .5) * (flame ? .26 : .42),
      vy: flame ? (ember ? 2.0 : 1.1) + strength * .25 + r() * .8 : (emitter.chimney ? 1.05 : .55) + r() * .45,
      vz: emitter.outward.z * (.25 + r() * .38) + (r() - .5) * (flame ? .26 : .42),
      size, baseSize: size, rotation: (r() - .5) * .85, spin: (r() - .5) * 1.3,
      age: 0, life, ember,
      color: flame ? (r() < .3 ? [1, .72, .12] : r() < .58 ? [1, .52, .05] : [1, .36, .02])
        : (r() < .5 ? [.27, .29, .30] : [.39, .40, .40]),
    });
  }

  function updateCloud(kind, dt) {
    const list = particles[kind], { positions, sizes, alphas, colors, rotations } = pointData[kind];
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) {
        if (kind === 'flame' && !p.ember && Math.random() < .55 && particles.smoke.length < capacities.smoke) {
          particles.smoke.push({
            ...p, age: 0, life: 1.3 + Math.random() * 1.2,
            vy: p.vy * .42, size: p.baseSize * 1.7, baseSize: p.baseSize * 1.7,
            color: [.33, .34, .34],
          });
        }
        list.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const progress = p.age / p.life;
      const opening = Math.min(1, progress / .18);
      const grow = opening * opening * (3 - 2 * opening);
      p.grow = grow;
      p.size = p.baseSize * (kind === 'smoke' ? 1 + progress * 1.15
        : (.3 + .7 * grow) * (1 - progress * (p.ember ? .48 : .62)));
      p.rotation += p.spin * dt;
    }
    for (let i = 0; i < list.length; i++) {
      const p = list[i], j = i * 3, fade = 1 - p.age / p.life;
      positions[j] = p.x; positions[j + 1] = p.y; positions[j + 2] = p.z;
      sizes[i] = p.size;
      alphas[i] = kind === 'flame' ? p.grow * Math.min(1, fade * 2.2) * (p.ember ? .8 : .96)
        : Math.min(1, p.age * 2.2) * Math.min(1, fade * 1.7) * .63;
      colors[j] = p.color[0];
      colors[j + 1] = kind === 'flame' ? p.color[1] * (.8 + fade * .28) : p.color[1];
      colors[j + 2] = p.color[2];
      rotations[i] = p.rotation;
    }
    const geometry = pointClouds[kind].geometry;
    geometry.setDrawRange(0, list.length);
    for (const attribute of Object.values(geometry.attributes)) attribute.needsUpdate = true;
  }

  return {
    registerBuilding,
    clear() {
      particles.flame.length = 0;
      particles.smoke.length = 0;
      pointClouds.flame.geometry.setDrawRange(0, 0);
      pointClouds.smoke.geometry.setDrawRange(0, 0);
      for (const emitter of emitters) { emitter.flameCarry = 0; emitter.smokeCarry = 0; }
    },
    update(dt, camera) {
      uniforms.uProjectionScale.value = innerHeight * Math.min(devicePixelRatio, 2) /
        (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      let spawned = 0;
      for (const emitter of emitters) {
        const percent = fireState.onFire.get(emitter.worldBuildingId) ?? 0;
        if (!percent || camera.position.distanceToSquared(emitter.center) > 110 * 110) continue;
        const strength = emitter.chimney ? chimneyFireStrength(percent) : windowFireStrength(percent, emitter.third);
        if (strength < 0) continue;
        const flameRate = (emitter.chimney ? CHIMNEY_FLAME_RATE : WINDOW_FLAME_RATE)[strength] * emitter.mass;
        const smokeRate = (emitter.chimney ? CHIMNEY_SMOKE_RATE : WINDOW_SMOKE_RATE)[strength] * emitter.mass;
        emitter.flameCarry += flameRate * dt;
        emitter.smokeCarry += smokeRate * dt;
        while (emitter.flameCarry >= 1 && spawned < 140) {
          spawn('flame', emitter, strength); emitter.flameCarry--; spawned++;
        }
        while (emitter.smokeCarry >= 1 && spawned < 140) {
          spawn('smoke', emitter, strength); emitter.smokeCarry--; spawned++;
        }
        emitter.flameCarry = Math.min(emitter.flameCarry, 2);
        emitter.smokeCarry = Math.min(emitter.smokeCarry, 2);
      }
      updateCloud('flame', dt);
      updateCloud('smoke', dt);
    },
  };
}
