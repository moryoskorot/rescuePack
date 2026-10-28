import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createGroundMarkers } from '../src/ground-markers.js';

test('hose impact rings face the struck wall while ground splashes stay horizontal', () => {
  const scene = new THREE.Scene();
  const markers = createGroundMarkers(THREE, scene, () => .2);
  const hit = new THREE.Vector3(8, 5, -3);
  const normal = new THREE.Vector3(1, 0, 0);
  markers.addWallImpact(hit, normal);
  const wallRing = scene.children.at(-1);
  assert.ok(wallRing.position.distanceTo(hit.clone().addScaledVector(normal, .09)) < 1e-6);
  assert.ok(new THREE.Vector3(0, 0, 1).applyQuaternion(wallRing.children[1].quaternion).distanceTo(normal) < 1e-6);

  markers.addGroundImpact({ x: 2, z: 4 });
  const groundRing = scene.children.at(-1);
  assert.equal(groundRing.position.y, .255);
  assert.ok(new THREE.Vector3(0, 0, 1).applyQuaternion(groundRing.children[1].quaternion).distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-6);
});
