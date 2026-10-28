// Ground cues share world coordinates with the truck, fire sites, and water.
export function createGroundMarkers(THREE, scene, getSurfaceHeight) {
  const blue = '#75eaff';
  const red = '#ff6231';
  const ringGeometry = new THREE.RingGeometry(3.05, 3.35, 64);
  const haloGeometry = new THREE.RingGeometry(2.75, 3.65, 64);
  const truckRing = new THREE.Group();
  for (const [geometry, opacity, height] of [[haloGeometry, .38, 0], [ringGeometry, 1, .012]]) {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color: blue, transparent: true, opacity, depthWrite: false,
      side: THREE.DoubleSide, toneMapped: false,
    }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = height;
    mesh.renderOrder = 3;
    truckRing.add(mesh);
  }
  truckRing.visible = false;
  scene.add(truckRing);

  const fireSquares = new Map();
  function dashedSquareGeometry(x, z, side, width, lift) {
    const positions = [];
    const half = side / 2;
    const segments = Math.max(8, Math.round(side / 1.35));
    function quad(ax, az, bx, bz, cx, cz, dx, dz) {
      for (const [px, pz] of [[ax, az], [bx, bz], [cx, cz], [ax, az], [cx, cz], [dx, dz]]) {
        positions.push(px, getSurfaceHeight(px, pz) + lift, pz);
      }
    }
    for (let i = 0; i < segments; i++) {
      const from = -half + (i + .12) * side / segments;
      const to = -half + (i + .76) * side / segments;
      for (const edge of [-1, 1]) {
        const fixed = edge * half;
        quad(x + from, z + fixed - width / 2, x + to, z + fixed - width / 2,
          x + to, z + fixed + width / 2, x + from, z + fixed + width / 2);
        quad(x + fixed - width / 2, z + from, x + fixed + width / 2, z + from,
          x + fixed + width / 2, z + to, x + fixed - width / 2, z + to);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }
  function registerFireSite(id, x, z, width, depth) {
    const side = Math.max(width, depth) + 2.7;
    const group = new THREE.Group();
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(side, side), new THREE.MeshBasicMaterial({
      color: '#ff4425', transparent: true, opacity: .22, depthWrite: false,
      side: THREE.DoubleSide, toneMapped: false,
    }));
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(x, getSurfaceHeight(x, z) + .017, z);
    fill.renderOrder = 1;
    group.add(fill);
    for (const [lineWidth, color, opacity, lift, additive] of [
      [1.25, '#ff4a1f', .15, .029, true],
      [.58, '#bc2a18', .92, .039, false],
      [.27, red, 1, .051, false],
    ]) {
      const dashes = new THREE.Mesh(dashedSquareGeometry(x, z, side, lineWidth, lift), new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, depthWrite: false,
        side: THREE.DoubleSide, toneMapped: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      }));
      dashes.renderOrder = 2;
      group.add(dashes);
    }
    group.visible = false;
    group.userData.glow = group.children[1];
    scene.add(group);
    fireSquares.set(id, group);
  }

  const impactGeometry = new THREE.RingGeometry(.77, 1, 40);
  const impactHaloGeometry = new THREE.RingGeometry(.56, 1.18, 40);
  const impacts = [];
  function removeImpact(impact) {
    scene.remove(impact.group);
    for (const mesh of impact.group.children) mesh.material.dispose();
  }
  function addImpact(point, normal = null) {
    const group = new THREE.Group();
    const wall = Boolean(normal);
    const facing = new THREE.Vector3(0, 0, 1);
    for (const [geometry, opacity, height] of [[impactHaloGeometry, .3, 0], [impactGeometry, .95, .012]]) {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        color: blue, transparent: true, opacity, depthWrite: false,
        side: THREE.DoubleSide, toneMapped: false,
      }));
      if (wall) {
        mesh.quaternion.setFromUnitVectors(facing, normal);
        mesh.position.copy(normal).multiplyScalar(height);
      } else {
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = height;
      }
      mesh.renderOrder = 4;
      group.add(mesh);
    }
    if (wall) group.position.copy(point).addScaledVector(normal, .09);
    else group.position.set(point.x, getSurfaceHeight(point.x, point.z) + .055, point.z);
    scene.add(group);
    impacts.push({ group, age: 0, wall });
    if (impacts.length > 12) removeImpact(impacts.shift());
  }
  function clearImpacts() {
    for (const impact of impacts) removeImpact(impact);
    impacts.length = 0;
  }
  return {
    registerFireSite,
    addGroundImpact(point) { addImpact(point); },
    addWallImpact(point, normal) { addImpact(point, normal); },
    clearImpacts,
    update(dt, truckPose, activeFireIds, elapsed) {
      truckRing.visible = Boolean(truckPose);
      if (truckPose) {
        truckRing.position.set(truckPose.x, getSurfaceHeight(truckPose.x, truckPose.z) + .055, truckPose.z);
        const pulse = 1 + .025 * Math.sin(elapsed * 3.8);
        truckRing.scale.set(pulse, 1, pulse);
      }
      for (const [id, square] of fireSquares) {
        square.visible = activeFireIds.has(id);
        if (square.visible) square.userData.glow.material.opacity = .16 + .06 * Math.sin(elapsed * 4 + square.id);
      }
      for (let i = impacts.length - 1; i >= 0; i--) {
        const impact = impacts[i];
        impact.age += dt;
        if (impact.age >= .65) {
          removeImpact(impact);
          impacts.splice(i, 1);
          continue;
        }
        const progress = impact.age / .65;
        const scale = (.55 + progress * 1.1) * (impact.wall ? .78 : 1);
        impact.group.scale.set(scale, 1, scale);
        for (const mesh of impact.group.children) mesh.material.opacity = (mesh === impact.group.children[0] ? .3 : .95) * (1 - progress) ** 1.5;
      }
    },
  };
}
