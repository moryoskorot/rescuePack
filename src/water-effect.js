// A pair of water jets and individual droplets stream from the truck's rear.
// All geometry stays attached to the vehicle so turning carries the spray.
export function advanceJetGrowth(growth, active, dt) {
  const change = dt / (active ? .46 : .22);
  return Math.max(0, Math.min(1, growth + (active ? change : -change)));
}

export function createWaterEffect(THREE, truck) {
  const spray = new THREE.Group();
  spray.visible = false;
  truck.add(spray);

  const waterMaterial = new THREE.MeshBasicMaterial({
    color: '#57cef5', transparent: true, opacity: .32, depthWrite: false,
    side: THREE.DoubleSide,
  });
  const foamMaterial = new THREE.MeshBasicMaterial({
    color: '#eaffff', transparent: true, opacity: .36, depthWrite: false,
    side: THREE.DoubleSide,
  });
  const jets = [];
  for (const side of [-1, 1]) {
    const plume = new THREE.Mesh(new THREE.CylinderGeometry(.11, .48, 4.9, 10, 1, true), waterMaterial);
    plume.rotation.x = Math.PI / 2;
    plume.position.set(side * .72, .73, -3);
    plume.scale.y = .001;
    plume.renderOrder = 3;
    spray.add(plume);
    jets.push({mesh: plume, length: 4.9, startZ: -3});
    const core = new THREE.Mesh(new THREE.CylinderGeometry(.045, .15, 3.1, 8, 1, true), foamMaterial);
    core.rotation.x = Math.PI / 2;
    core.position.set(side * .72, .76, -2.97);
    core.scale.y = .001;
    core.renderOrder = 4;
    spray.add(core);
    jets.push({mesh: core, length: 3.1, startZ: -2.97});
  }

  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = textureCanvas.height = 32;
  const context = textureCanvas.getContext('2d');
  const gradient = context.createRadialGradient(16, 16, 2, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.35, 'rgba(224,250,255,.95)');
  gradient.addColorStop(1, 'rgba(121,217,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 32);
  const dropletTexture = new THREE.CanvasTexture(textureCanvas);
  const count = 126;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const blue = new THREE.Color('#65d9fa'), white = new THREE.Color('#edffff');
  for (let i = 0; i < count; i++) {
    const color = i % 5 === 0 ? white : blue;
    colors.set(color.toArray(), i * 3);
  }
  const droplets = new THREE.BufferGeometry();
  droplets.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  droplets.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dropletMaterial = new THREE.PointsMaterial({
    map: dropletTexture, size: .45, sizeAttenuation: true, transparent: true,
    opacity: .9, depthWrite: false, vertexColors: true, blending: THREE.NormalBlending,
  });
  const sprayPoints = new THREE.Points(droplets, dropletMaterial);
  sprayPoints.frustumCulled = false;
  sprayPoints.renderOrder = 5;
  spray.add(sprayPoints);

  let growth = 0;
  return {
    update(active, elapsed, dt) {
      growth = advanceJetGrowth(growth, active, dt);
      spray.visible = growth > .005;
      if (!spray.visible) return;
      const reach = growth * growth * (3 - 2 * growth);
      for (const {mesh, length, startZ} of jets) {
        mesh.scale.y = Math.max(.001, reach);
        mesh.position.z = startZ - length * reach / 2;
      }
      waterMaterial.opacity = .32 * Math.min(1, growth * 3);
      foamMaterial.opacity = .36 * Math.min(1, growth * 3);
      dropletMaterial.opacity = .92 * Math.min(1, growth * 3);
      droplets.setDrawRange(0, Math.round(count * growth));
      for (let i = 0; i < count; i++) {
        const phase = (elapsed * 3.5 + (i * .61803398875) % 1) % 1;
        const side = i % 2 ? 1 : -1;
        const ripple = Math.sin(i * 9.31 + elapsed * 17);
        const offset = i * 3;
        positions[offset] = side * (.72 + phase * .65 * reach) + ripple * (.05 + phase * .28 * reach);
        positions[offset + 1] = .85 - phase * .72 * reach + Math.cos(i * 3.7 + elapsed * 12) * .1 * phase * reach;
        positions[offset + 2] = -3.05 - phase * 5.7 * reach;
      }
      droplets.attributes.position.needsUpdate = true;
    },
  };
}
