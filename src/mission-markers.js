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
    const color = { collect: '#65d9ff', book: '#65d9ff', return: '#ffd65a', fire: '#ff7b54', fix: '#87ecc4', rescue: '#e5adff' }[kind];
    const ground = getSurfaceHeight(point.x, point.z);
    group.position.set(point.x, ground + .06, point.z);
    const pickup = kind === 'collect' || kind === 'book';
    const radius = pickup ? 1.25 : 2.25;
    for (const [inner, outer, opacity, y] of [[radius - .18, radius + .42, .22, 0], [radius, radius + .2, .95, .018], [radius - .43, radius - .34, .75, .03]]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 64), new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
        toneMapped: false, blending: opacity === .22 ? THREE.AdditiveBlending : THREE.NormalBlending,
      }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = y; ring.renderOrder = 5;
      group.add(ring);
    }
    if (kind === 'book') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(.9, .8, .7), new THREE.MeshStandardMaterial({ color: '#ffcf64', roughness: .55 }));
      box.position.y = .42; box.castShadow = true; group.add(box);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(.54, .1, .03), new THREE.MeshBasicMaterial({ color: '#527fb7' }));
      slot.position.set(0, .58, .365); group.add(slot);
    }
    const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures[kind], transparent: true, depthWrite: false, toneMapped: false }));
    const size = pickup ? 3.1 : 4.6;
    orb.scale.set(size, size, 1); orb.position.y = pickup ? 2.15 : 3; orb.renderOrder = 6;
    group.add(orb);
    scene.add(group);
    entries.push({ group, orb, pickup });
  }
  return {
    clear,
    set(points) { clear(); points.forEach(({ point, kind }) => add(point, kind)); },
    update(elapsed) {
      entries.forEach(({ group, orb, pickup }, index) => {
        orb.position.y = (pickup ? 2.15 : 3) + .17 * Math.sin(elapsed * 2.6 + index);
        const pulse = 1 + .05 * Math.sin(elapsed * 3.5 + index);
        group.children[1].scale.setScalar(pulse);
      });
    },
  };
}
