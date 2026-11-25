import { ROAD_Y } from './world-layout.js';

const palettes = {
  red: { fill: '#fa2b365c', glow: '#ff344c', edge: '#ff606c', core: '#ffd2cd' },
  blue: { fill: '#235ff05c', glow: '#2978ff', edge: '#549dff', core: '#c6e8ff' },
};

function chevronTexture(THREE, palette) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(128, 35);
  ctx.lineTo(219, 112);
  ctx.lineTo(193, 142);
  ctx.lineTo(128, 88);
  ctx.lineTo(63, 142);
  ctx.lineTo(37, 112);
  ctx.closePath();
  ctx.fillStyle = palette.fill;
  ctx.fill();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 21;
  ctx.lineWidth = 11;
  ctx.strokeStyle = palette.glow;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 8;
  ctx.strokeStyle = palette.edge;
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = palette.core;
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createRoadMarkers(THREE, scene) {
  const group = new THREE.Group();
  group.name = 'Road navigation markers';
  scene.add(group);
  const geometry = new THREE.PlaneGeometry(4.7, 3.5).rotateX(-Math.PI / 2);
  const textures = Object.fromEntries(Object.entries(palettes)
    .map(([color, palette]) => [color, chevronTexture(THREE, palette)]));

  function addMesh() {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      map: textures.blue, transparent: true, depthWrite: false, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    }));
    mesh.renderOrder = 1;
    group.add(mesh);
    return mesh;
  }

  return {
    update(markers) {
      for (const [index, marker] of markers.entries()) {
        const mesh = group.children[index] ?? addMesh();
        mesh.position.set(marker.x, ROAD_Y + .022, marker.z);
        // The texture tip points along local -Z on the flat plane.
        mesh.rotation.y = Math.atan2(marker.dx, marker.dz) + Math.PI;
        mesh.material.map = textures[marker.color];
        mesh.material.opacity = marker.opacity;
        mesh.visible = true;
      }
      for (let i = markers.length; i < group.children.length; i++) group.children[i].visible = false;
    },
  };
}
