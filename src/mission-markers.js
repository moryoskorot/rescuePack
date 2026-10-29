function orbTexture(THREE, glyph, colors) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(128, 126, 30, 128, 128, 124);
  glow.addColorStop(0, colors[0]);
  glow.addColorStop(.58, colors[1]);
  glow.addColorStop(.79, colors[2]);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 256, 256);
  ctx.beginPath(); ctx.arc(128, 123, 80, 0, Math.PI * 2);
  const shell = ctx.createLinearGradient(50, 42, 200, 210);
  shell.addColorStop(0, '#eeedff'); shell.addColorStop(.22, colors[0]);
  shell.addColorStop(.58, colors[1]); shell.addColorStop(1, colors[2]);
  ctx.fillStyle = shell; ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = '#ffffffd9'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(99, 76, 35, 13, -.42, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff99'; ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 125px Arial';
  ctx.lineWidth = 9; ctx.strokeStyle = '#2559b8'; ctx.strokeText(glyph, 128, 130);
  ctx.fillStyle = '#fffefa'; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 22;
  ctx.fillText(glyph, 128, 130);
  return new THREE.CanvasTexture(canvas);
}

export function createMissionMarkers(THREE, scene, getSurfaceHeight) {
  const textures = {
    collect: orbTexture(THREE, '!', ['#bfeaff', '#319cf4', '#6239b3']),
    book: orbTexture(THREE, '!', ['#bfeaff', '#319cf4', '#6239b3']),
    return: orbTexture(THREE, '↩', ['#fff5b1', '#ffc444', '#ec7a37']),
    fire: orbTexture(THREE, '!', ['#ffeaaa', '#ff8c47', '#dc3d4b']),
    fix: orbTexture(THREE, '!', ['#d6ffcf', '#69d6a5', '#158b91']),
    rescue: orbTexture(THREE, '!', ['#fce2ff', '#f49bd9', '#9953ce']),
    race: orbTexture(THREE, '★', ['#fff4ba', '#ffbd50', '#ef779e']),
  };
  const entries = [];
  function clear() {
    for (const { group } of entries) {
      scene.remove(group);
      group.traverse(object => {
        if (object.isMesh || object.isSprite) object.material.dispose();
        if (object.isMesh) object.geometry.dispose();
      });
    }
    entries.length = 0;
  }
  function add(point, kind = 'collect') {
    const group = new THREE.Group();
    const color = { return: '#ffd65a', fire: '#ff7b54', fix: '#87ecc4', rescue: '#e5adff', race: '#ffe284' }[kind] ?? '#65d9ff';
    const ground = getSurfaceHeight(point.x, point.z);
    group.position.set(point.x, ground + .06, point.z);
    const pickup = !['return','fire','fix','rescue','race'].includes(kind);
    const radius = pickup ? 1.25 : 2.25;
    for (const [inner, outer, opacity, y] of [[radius - .18, radius + .42, .22, 0], [radius, radius + .2, .95, .018], [radius - .43, radius - .34, .75, .03]]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 64), new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
        toneMapped: false, blending: opacity === .22 ? THREE.AdditiveBlending : THREE.NormalBlending,
      }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = y; ring.renderOrder = 5;
      group.add(ring);
    }
    let progressRing = null;
    if (kind === 'return' || kind === 'fix' || kind === 'rescue') {
      progressRing = new THREE.Group();
      progressRing.position.y = .055;
      progressRing.visible = false;
      for (let segment = 0; segment < 16; segment++) {
        const mesh = new THREE.Mesh(
          new THREE.RingGeometry(2.47, 2.94, 2, 1, segment * Math.PI / 8 + .045, Math.PI / 8 - .09),
          new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .25, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = 7;
        progressRing.add(mesh);
      }
      group.add(progressRing);
    }
    if (pickup) {
      const material = new THREE.MeshStandardMaterial({ color: kind === 'carrot' ? '#f38e36' :
        kind === 'gear' || kind === 'tool' || kind === 'nozzle' ? '#b7d1db' :
        kind === 'letter' || kind === 'card' ? '#f9f5dc' :
        kind === 'pompom' ? '#f593cd' : '#ffc963', roughness: .55 });
      let geometry = new THREE.BoxGeometry(.8,.65,.65);
      if (kind === 'carrot') geometry = new THREE.ConeGeometry(.36,1,10);
      if (kind === 'gear') geometry = new THREE.TorusGeometry(.39,.13,6,12);
      if (kind === 'pompom' || kind === 'shape') geometry = new THREE.SphereGeometry(.46,12,8);
      if (kind === 'letter' || kind === 'card') geometry = new THREE.BoxGeometry(.85,.08,.65);
      if (kind === 'nozzle' || kind === 'tool') geometry = new THREE.CylinderGeometry(.18,.29,.88,10);
      const item = new THREE.Mesh(geometry,material);
      if (kind === 'carrot') item.rotation.z = Math.PI;
      if (kind === 'gear') item.rotation.x = Math.PI/2;
      if (kind === 'nozzle' || kind === 'tool') item.rotation.z = Math.PI/2;
      item.position.y = kind === 'carrot' ? .65 : .43; item.castShadow = true; group.add(item);
      if (kind === 'carrot') {
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(.33,.5,6),new THREE.MeshStandardMaterial({color:'#68b56b'}));
        leaves.position.y=1.25;group.add(leaves);
      }
      if (kind === 'book') {
        const slot = new THREE.Mesh(new THREE.BoxGeometry(.54,.1,.03),new THREE.MeshBasicMaterial({color:'#527fb7'}));
        slot.position.set(0,.58,.35);group.add(slot);
      }
    }
    const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures[kind] ?? textures.collect, transparent: true, depthWrite: false, toneMapped: false }));
    const size = pickup ? 3.1 : 4.6;
    orb.scale.set(size, size, 1); orb.position.y = pickup ? 2.15 : 3; orb.renderOrder = 6;
    group.add(orb);
    scene.add(group);
    entries.push({ group, orb, pickup, kind, progressRing });
  }
  return {
    clear,
    set(points) { clear(); points.forEach(({ point, kind }) => add(point, kind)); },
    setProgress(kind, progress, active) {
      for (const entry of entries) {
        if (!entry.progressRing) continue;
        const visible = entry.kind === kind && active;
        entry.progressRing.visible = visible;
        if (!visible) continue;
        entry.progressRing.children.forEach((segment, index) => {
          segment.material.opacity = (index + 1) / 16 <= progress ? .98 : .22;
        });
      }
    },
    update(elapsed) {
      entries.forEach(({ group, orb, pickup, progressRing }, index) => {
        orb.position.y = (pickup ? 2.15 : 3) + .17 * Math.sin(elapsed * 2.6 + index);
        const pulse = 1 + .05 * Math.sin(elapsed * 3.5 + index);
        group.children[1].scale.setScalar(pulse);
        if (progressRing?.visible) progressRing.rotation.y = elapsed * 1.65;
      });
    },
  };
}
