export function worldWindowTargets(THREE, object, windows) {
  object.updateWorldMatrix(true, true);
  return windows.map(window => {
    const corners = window.corners.map(corner => object.localToWorld(new THREE.Vector3(...corner)));
    const center = corners.reduce((sum, corner) => sum.add(corner), new THREE.Vector3()).multiplyScalar(1 / 4);
    const right = corners[1].clone().sub(corners[0]);
    const up = corners[3].clone().sub(corners[0]);
    const sideNormals = {'+X':[1,0,0],'-X':[-1,0,0],'+Z':[0,0,1],'-Z':[0,0,-1]};
    const normal = window.side ? new THREE.Vector3(...sideNormals[window.side]).transformDirection(object.matrixWorld)
      : right.clone().cross(up).normalize();
    return { id: window.id, center, corners, right, up, normal };
  });
}

export function nearestWindowTarget(position, windows) {
  const facing = (windows ?? []).filter(window => window.normal.dot(position.clone().sub(window.center)) > .02);
  let best = null, bestDistance = Infinity;
  for (const window of facing.length ? facing : windows ?? []) {
    const distance = window.center.distanceToSquared(position);
    if (distance < bestDistance) { best = window; bestDistance = distance; }
  }
  return best;
}

export function segmentWindowHit(start, end, windows) {
  let first = null;
  for (const window of windows ?? []) {
    const delta = end.clone().sub(start);
    const denominator = window.normal.dot(delta);
    if (Math.abs(denominator) < 1e-8) continue;
    const t = window.normal.dot(window.corners[0].clone().sub(start)) / denominator;
    if (t < -1e-6 || t > 1 + 1e-6) continue;
    const point = start.clone().addScaledVector(delta, Math.max(0, Math.min(1, t)));
    const relative = point.clone().sub(window.corners[0]);
    const u = relative.dot(window.right) / window.right.lengthSq();
    const v = relative.dot(window.up) / window.up.lengthSq();
    if (u < -1e-5 || u > 1 + 1e-5 || v < -1e-5 || v > 1 + 1e-5) continue;
    if (!first || t < first.t) first = { window, point, t };
  }
  return first;
}
