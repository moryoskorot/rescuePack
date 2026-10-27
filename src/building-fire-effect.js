import { windowFireStrength, windowThird } from './building-fire.js';

// A pair of dynamic point clouds keeps the visual cost bounded even when many
// windows burn. Particle positions are calculated from each placed GLB's own
// local window map; the same source model can burn at several world sites.
export function createBuildingFireEffect(THREE, scene, fireState) {
  const emitters = [];
  const particles = { flame: [], smoke: [] };
  const capacities = { flame: 500, smoke: 700 };
  const pointClouds = {};
  const pointData = {};
  const uniforms = { uProjectionScale: { value: 800 } };
  const vertexShader = `
    attribute float aSize;
    attribute float aAlpha;
    attribute vec3 aColor;
    uniform float uProjectionScale;
    varying vec4 vColor;
    void main() {
      vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * viewPosition;
      gl_PointSize = clamp(aSize * uProjectionScale / max(1.0, -viewPosition.z), 1.0, 80.0);
      vColor = vec4(aColor, aAlpha);
    }
  `;
  const fragmentShader = `
    varying vec4 vColor;
    void main() {
      float distanceFromCenter = length(gl_PointCoord - 0.5) * 2.0;
      float edge = 1.0 - smoothstep(0.4, 1.0, distanceFromCenter);
      gl_FragColor = vec4(vColor.rgb, vColor.a * edge);
    }
  `;
  for (const kind of ['flame', 'smoke']) {
    const capacity = capacities[kind];
    const positions = new Float32Array(capacity * 3);
    const sizes = new Float32Array(capacity);
    const alphas = new Float32Array(capacity);
    const colors = new Float32Array(capacity * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    const material = new THREE.ShaderMaterial({
      uniforms, vertexShader, fragmentShader, transparent: true,
      depthWrite: false, depthTest: true,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = kind === 'flame' ? 6 : 5;
    scene.add(points);
    pointClouds[kind] = points;
    pointData[kind] = { positions, sizes, alphas, colors };
  }

  const local = new THREE.Vector3();
  const outward = new THREE.Vector3();
  const sideways = new THREE.Vector3();
  function registerBuilding(worldBuildingId, object, windows, modelMinY, modelMaxY) {
    object.updateWorldMatrix(true, true);
    for (const window of windows) {
      const normal = window.side === '+X' ? [1, 0, 0] : window.side === '-X' ? [-1, 0, 0]
        : window.side === '+Z' ? [0, 0, 1] : [0, 0, -1];
      local.fromArray(window.center);
      const center = object.localToWorld(local).clone();
      outward.fromArray(normal).transformDirection(object.matrixWorld);
      sideways.set(window.side.endsWith('Z') ? 1 : 0, 0, window.side.endsWith('X') ? 1 : 0)
        .transformDirection(object.matrixWorld);
      emitters.push({
        worldBuildingId,
        center,
        outward: outward.clone(),
        sideways: sideways.clone(),
        width: window.width * object.scale.x,
        height: window.height * object.scale.y,
        third: windowThird(window.center[1], modelMinY, modelMaxY),
        flameCarry: Math.random(),
        smokeCarry: Math.random(),
      });
    }
  }

  function spawn(kind, emitter, strength) {
    const list = particles[kind];
    if (list.length >= capacities[kind]) return;
    const r = Math.random;
    const offset = (r() - .5) * emitter.width * .85;
    const up = (r() - .4) * emitter.height * .55;
    const sizeFactor = Math.max(.6, Math.min(2.2, Math.sqrt(emitter.width * emitter.height)));
    const flame = kind === 'flame';
    const life = flame ? [.0, .35, .6, .9][strength] + r() * [.0, .3, .55, .85][strength]
      : 1.05 + r() * (strength === 3 ? 1.4 : .9);
    const origin = emitter.center;
    list.push({
      x: origin.x + emitter.sideways.x * offset + emitter.outward.x * .2,
      y: origin.y + up,
      z: origin.z + emitter.sideways.z * offset + emitter.outward.z * .2,
      vx: emitter.outward.x * (.25 + r() * .45) + (r() - .5) * .35,
      vy: (flame ? 1.0 + strength * .3 : .65) + r() * .8,
      vz: emitter.outward.z * (.25 + r() * .45) + (r() - .5) * .35,
      size: (flame ? .22 + strength * .11 : .42 + strength * .12) * sizeFactor * (.75 + r() * .6),
      age: 0, life,
      color: flame ? (r() < .35 ? [1, .67, .08] : [1, .26 + r() * .22, .025])
        : (r() < .5 ? [.31, .32, .32] : [.42, .43, .42]),
    });
  }

  function updateCloud(kind, dt) {
    const list = particles[kind], { positions, sizes, alphas, colors } = pointData[kind];
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) {
        if (kind === 'flame' && particles.smoke.length < capacities.smoke) {
          particles.smoke.push({
            ...p, age: 0, life: 1.1 + Math.random() * .9,
            vy: p.vy * .55, size: p.size * 1.35,
            color: [.37, .38, .37],
          });
        }
        list.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.size *= 1 + (kind === 'smoke' ? .32 : -.08) * dt;
    }
    for (let i = 0; i < list.length; i++) {
      const p = list[i], j = i * 3, fade = 1 - p.age / p.life;
      positions[j] = p.x; positions[j + 1] = p.y; positions[j + 2] = p.z;
      sizes[i] = p.size;
      alphas[i] = kind === 'flame' ? Math.min(1, fade * 2) * .95 : Math.min(1, p.age * 3) * fade * .56;
      colors[j] = p.color[0]; colors[j + 1] = p.color[1]; colors[j + 2] = p.color[2];
    }
    const geometry = pointClouds[kind].geometry;
    geometry.setDrawRange(0, list.length);
    for (const attribute of Object.values(geometry.attributes)) attribute.needsUpdate = true;
  }

  return {
    registerBuilding,
    update(dt, camera) {
      uniforms.uProjectionScale.value = innerHeight * Math.min(devicePixelRatio, 2) /
        (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      let spawned = 0;
      for (const emitter of emitters) {
        const percent = fireState.onFire.get(emitter.worldBuildingId) ?? 0;
        if (!percent || camera.position.distanceToSquared(emitter.center) > 110 * 110) continue;
        const strength = windowFireStrength(percent, emitter.third);
        if (strength < 0) continue;
        const sizeFactor = Math.max(.5, Math.min(2.4, Math.sqrt(emitter.width * emitter.height) / 1.1));
        const flameRate = [0, 1.7, 2.7, 3.7][strength] * sizeFactor;
        const smokeRate = [1.2, .7, 1.5, 2.8][strength] * sizeFactor;
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
