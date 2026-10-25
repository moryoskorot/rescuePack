// Water droplets live in world space after leaving the truck. Their trail can
// bend through a drift instead of rotating as one rigid shape with the model.
export function advanceJetGrowth(growth, active, dt) {
  const change = dt / (active ? .46 : .22);
  return Math.max(0, Math.min(1, growth + (active ? change : -change)));
}

function cartoonCircleTexture(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(32, 32, 30, 0, Math.PI * 2);
  context.fill();
  return new THREE.CanvasTexture(canvas);
}

export function createWaterEffect(THREE, scene, truck, getSurfaceHeight, surfaceAt) {
  const texture = cartoonCircleTexture(THREE);
  const maxDrops = 260, maxSplashes = 190;
  const drops = [], splashes = [];
  let growth = 0, emission = 0, emitted = 0, seed = 177;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const dropPositions = new Float32Array(maxDrops * 3);
  const dropColors = new Float32Array(maxDrops * 4);
  const dropGeometry = new THREE.BufferGeometry();
  dropGeometry.setAttribute('position', new THREE.BufferAttribute(dropPositions, 3).setUsage(THREE.DynamicDrawUsage));
  dropGeometry.setAttribute('color', new THREE.BufferAttribute(dropColors, 4).setUsage(THREE.DynamicDrawUsage));
  dropGeometry.setDrawRange(0, 0);
  const dropPoints = new THREE.Points(dropGeometry, new THREE.PointsMaterial({
    map: texture, size: .7, sizeAttenuation: true, transparent: true,
    depthWrite: false, vertexColors: true, toneMapped: false, alphaTest: .5,
  }));
  dropPoints.frustumCulled = false;
  dropPoints.renderOrder = 4;
  scene.add(dropPoints);

  const splashPositions = new Float32Array(maxSplashes * 18);
  const splashColors = new Float32Array(maxSplashes * 24);
  const splashUvs = new Float32Array(maxSplashes * 12);
  const uvPattern = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1];
  for (let i = 0; i < maxSplashes; i++) splashUvs.set(uvPattern, i * 12);
  const splashGeometry = new THREE.BufferGeometry();
  splashGeometry.setAttribute('position', new THREE.BufferAttribute(splashPositions, 3).setUsage(THREE.DynamicDrawUsage));
  splashGeometry.setAttribute('color', new THREE.BufferAttribute(splashColors, 4).setUsage(THREE.DynamicDrawUsage));
  splashGeometry.setAttribute('uv', new THREE.BufferAttribute(splashUvs, 2));
  splashGeometry.setDrawRange(0, 0);
  const splashMesh = new THREE.Mesh(splashGeometry, new THREE.MeshBasicMaterial({
    map: texture, transparent: true, vertexColors: true, depthWrite: false,
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1,
    polygonOffsetUnits: -2, toneMapped: false,
  }));
  splashMesh.frustumCulled = false;
  splashMesh.renderOrder = 3;
  scene.add(splashMesh);

  const nozzle = new THREE.Vector3();
  const backward = new THREE.Vector3();
  const sideways = new THREE.Vector3();
  function emitDrop(reach) {
    const side = emitted++ % 2 ? 1 : -1;
    nozzle.set(side * .72, .75, -3.05);
    truck.localToWorld(nozzle);
    backward.set(0, 0, -1).transformDirection(truck.matrixWorld);
    sideways.set(1, 0, 0).transformDirection(truck.matrixWorld);
    const speed = (3.8 + random() * 3.2) * (.35 + .65 * reach);
    const spread = (random() - .5) * 1.8;
    drops.push({
      x: nozzle.x, y: nozzle.y, z: nozzle.z,
      vx: backward.x * speed + sideways.x * spread,
      vy: .45 + random() * .75,
      vz: backward.z * speed + sideways.z * spread,
      age: 0,
      blue: random() > .2,
    });
    if (drops.length > maxDrops) drops.shift();
  }

  function addSplash(drop, floor) {
    if (surfaceAt(drop.x, drop.z) === 'water') return;
    const magnitude = Math.hypot(drop.vx, drop.vz) || 1;
    splashes.push({
      x: drop.x, y: floor + .025, z: drop.z,
      dx: drop.vx / magnitude, dz: drop.vz / magnitude,
      length: .55 + random() * .25,
      width: .26 + random() * .14,
      life: .5 + random() * .2,
      age: 0,
    });
    if (splashes.length > maxSplashes) splashes.shift();
  }

  function renderDrops() {
    for (let i = 0; i < drops.length; i++) {
      const drop = drops[i], p = i * 3, c = i * 4;
      dropPositions[p] = drop.x;
      dropPositions[p + 1] = drop.y;
      dropPositions[p + 2] = drop.z;
      dropColors[c] = drop.blue ? .055 : .24;
      dropColors[c + 1] = drop.blue ? .45 : .76;
      dropColors[c + 2] = 1;
      dropColors[c + 3] = 1;
    }
    dropGeometry.setDrawRange(0, drops.length);
    dropGeometry.attributes.position.needsUpdate = true;
    dropGeometry.attributes.color.needsUpdate = true;
  }

  const corners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
  function renderSplashes() {
    for (let i = 0; i < splashes.length; i++) {
      const splash = splashes[i];
      const halfLength = splash.length / 2, halfWidth = splash.width / 2;
      const sx = -splash.dz, sz = splash.dx;
      const alpha = .48 * (1 - splash.age / splash.life) ** 1.5;
      for (let j = 0; j < 6; j++) {
        const [side, forward] = corners[j];
        const p = i * 18 + j * 3, c = i * 24 + j * 4;
        splashPositions[p] = splash.x + sx * side * halfWidth + splash.dx * forward * halfLength;
        splashPositions[p + 1] = splash.y;
        splashPositions[p + 2] = splash.z + sz * side * halfWidth + splash.dz * forward * halfLength;
        splashColors[c] = .075;
        splashColors[c + 1] = .54;
        splashColors[c + 2] = .98;
        splashColors[c + 3] = alpha;
      }
    }
    splashGeometry.setDrawRange(0, splashes.length * 6);
    splashGeometry.attributes.position.needsUpdate = true;
    splashGeometry.attributes.color.needsUpdate = true;
  }

  return {
    update(active, _elapsed, dt) {
      growth = advanceJetGrowth(growth, active, dt);
      const reach = growth * growth * (3 - 2 * growth);
      if (active && reach > .015) {
        truck.updateWorldMatrix(true, false);
        emission += dt * (20 + 90 * reach);
        while (emission >= 1) {
          emitDrop(reach);
          emission--;
        }
      } else emission = 0;

      for (let i = drops.length - 1; i >= 0; i--) {
        const drop = drops[i];
        drop.age += dt;
        drop.x += drop.vx * dt;
        drop.z += drop.vz * dt;
        drop.vy -= 16 * dt;
        drop.y += drop.vy * dt;
        const floor = getSurfaceHeight(drop.x, drop.z);
        if (drop.y <= floor + .045 || drop.age > 1.3) {
          if (drop.y <= floor + .045) addSplash(drop, floor);
          drops.splice(i, 1);
        }
      }
      for (let i = splashes.length - 1; i >= 0; i--) {
        splashes[i].age += dt;
        if (splashes[i].age >= splashes[i].life) splashes.splice(i, 1);
      }
      renderDrops();
      renderSplashes();
    },
  };
}
