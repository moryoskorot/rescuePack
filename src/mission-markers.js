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
    return: orbTexture(THREE, '↩', ['#fff5b1', '#ffc444', '#ec7a37']),
    fire: orbTexture(THREE, '!', ['#ffeaaa', '#ff8c47', '#dc3d4b']),
    fix: orbTexture(THREE, '!', ['#d6ffcf', '#69d6a5', '#158b91']),
    rescue: orbTexture(THREE, '!', ['#fce2ff', '#f49bd9', '#9953ce']),
  };
  const entries = [];
  function clear() {
    for (const { group } of entries) {
      scene.remove(group);
      group.traverse(object => { if (object.isMesh || object.isSprite) object.material.dispose(); });
    }
    entries.length = 0;
  }
  function add(point, kind = 'collect') {
    const group = new THREE.Group();
    const color = { collect: '#65d9ff', return: '#ffd65a', fire: '#ff7b54', fix: '#87ecc4', rescue: '#e5adff' }[kind];
    const ground = getSurfaceHeight(point.x, point.z);
    group.position.set(point.x, ground + .06, point.z);
    for (const [inner, outer, opacity, y] of [[2.1, 3.1, .22, 0], [2.4, 2.68, .95, .018], [1.75, 1.88, .75, .03]]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 64), new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
        toneMapped: false, blending: inner === 2.1 ? THREE.AdditiveBlending : THREE.NormalBlending,
      }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = y; ring.renderOrder = 5;
      group.add(ring);
    }
    const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures[kind], transparent: true, depthWrite: false, toneMapped: false }));
    orb.scale.set(5.5, 5.5, 1); orb.position.y = 3.1; orb.renderOrder = 6;
    group.add(orb);
    scene.add(group);
    entries.push({ group, orb });
  }
  return {
    clear,
    set(points) { clear(); points.forEach(({ point, kind }) => add(point, kind)); },
    update(elapsed) {
      entries.forEach(({ group, orb }, index) => {
        orb.position.y = 3.1 + .25 * Math.sin(elapsed * 2.6 + index);
        const pulse = 1 + .05 * Math.sin(elapsed * 3.5 + index);
        group.children[1].scale.setScalar(pulse);
      });
    },
  };
}
