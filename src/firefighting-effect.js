import { advanceJetGrowth } from './water-effect.js';

// A bright continuous core, broken spray, and impact droplets share two bounded
// point clouds. The strand follows a shallow arc from the roof nozzle to the wall.
export function createFirefightingEffect(THREE, scene) {
  const uniforms = { projectionScale: { value: 700 } };
  const vertexShader = `
    attribute float aSize;
    attribute float aOpacity;
    attribute vec3 aColor;
    uniform float projectionScale;
    varying vec4 color;
    void main() {
      vec4 view = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * view;
      gl_PointSize = clamp(aSize * projectionScale / max(1.0, -view.z), 1.0, 26.0);
      color = vec4(aColor, aOpacity);
    }
  `;
  const fragmentShader = `
    varying vec4 color;
    void main() {
      float radius = length(gl_PointCoord - vec2(0.5));
      float edge = 1.0 - smoothstep(0.39, 0.50, radius);
      gl_FragColor = vec4(color.rgb, color.a * edge);
    }
  `;
  function cloud(capacity, renderOrder) {
    const positions = new Float32Array(capacity * 3);
    const sizes = new Float32Array(capacity);
    const opacities = new Float32Array(capacity);
    const colors = new Float32Array(capacity * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    const points = new THREE.Points(geometry, new THREE.ShaderMaterial({
      uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false,
      depthTest: true, blending: THREE.NormalBlending,
    }));
    points.frustumCulled = false;
    points.renderOrder = renderOrder;
    scene.add(points);
    return { geometry, positions, sizes, opacities, colors };
  }
  const core = cloud(150, 7), spray = cloud(150, 8);
  const origin = new THREE.Vector3(), impact = new THREE.Vector3();
  let growth = 0, time = 0;
  const fract = n => n - Math.floor(n);
  const hash = n => fract(Math.sin(n * 127.1) * 43758.5453);
  function put(cloud, index, x, y, z, size, opacity, color) {
    const p = index * 3;
    cloud.positions[p] = x; cloud.positions[p + 1] = y; cloud.positions[p + 2] = z;
    cloud.sizes[index] = size;
    cloud.opacities[index] = opacity;
    cloud.colors[p] = color[0]; cloud.colors[p + 1] = color[1]; cloud.colors[p + 2] = color[2];
  }
  function commit(cloud, count) {
    cloud.geometry.setDrawRange(0, count);
    for (const attribute of Object.values(cloud.geometry.attributes)) attribute.needsUpdate = true;
  }
  function curve(t) {
    const lift = Math.sin(Math.PI * t) * .85;
    return {
      x: origin.x + (impact.x - origin.x) * t,
      y: origin.y + (impact.y - origin.y) * t + lift,
      z: origin.z + (impact.z - origin.z) * t,
    };
  }
  return {
    update(active, start, end, dt, camera) {
      time += dt;
      if (active && start && end) { origin.copy(start); impact.copy(end); }
      growth = advanceJetGrowth(growth, active, dt);
      if (camera) uniforms.projectionScale.value = (globalThis.innerHeight || 800) * Math.min(globalThis.devicePixelRatio || 1, 2)
        / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      if (growth <= 0) { commit(core, 0); commit(spray, 0); return; }

      const coreCount = Math.max(2, Math.ceil(145 * growth));
      for (let i = 0; i < coreCount; i++) {
        const t = i / (coreCount - 1) * growth;
        const p = curve(t);
        const ripple = Math.sin(t * 85 - time * 37) * .045;
        const bright = i % 7 === 0;
        put(core, i, p.x + ripple, p.y + Math.cos(t * 71 - time * 29) * .035, p.z - ripple,
          bright ? .33 : .31, bright ? .96 : .91,
          bright ? [.92, 1, 1] : [.13, .67, 1]);
      }
      commit(core, coreCount);

      let count = 0;
      for (let i = 0; i < 95; i++) {
        const t = fract(i * .618034 + time * .9) * growth;
        const p = curve(t);
        const angle = hash(i + 1) * Math.PI * 2;
        const width = (.13 + .42 * t) * (hash(i + 101) ** 1.8);
        put(spray, count++, p.x + Math.cos(angle) * width, p.y + Math.sin(angle * 1.3) * width,
          p.z + Math.sin(angle) * width, .08 + hash(i + 19) * .18, .4 + hash(i + 37) * .45,
          i % 3 === 0 ? [.86, 1, 1] : [.14, .62, 1]);
      }
      if (growth > .95) for (let i = 0; i < 45; i++) {
        const phase = fract(i * .754877 + time * 1.8);
        const angle = hash(i + 401) * Math.PI * 2;
        const radius = phase * (1.1 + hash(i + 509) * .9);
        put(spray, count++, impact.x + Math.cos(angle) * radius,
          impact.y + Math.sin(angle * 1.4) * radius * .7 - phase * phase * .35,
          impact.z + Math.sin(angle) * radius,
          .09 + hash(i + 619) * .22, (1 - phase) * .9,
          i % 4 === 0 ? [.95, 1, 1] : [.34, .82, 1]);
      }
      commit(spray, count);
    },
  };
}
