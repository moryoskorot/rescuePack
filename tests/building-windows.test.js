import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { BUILDING_TYPES } from '../src/building-catalog.js';

const windows = JSON.parse(readFileSync(new URL('../src/building-windows.json', import.meta.url), 'utf8'));

test('every source building has stable, unique type and window IDs', () => {
  assert.equal(BUILDING_TYPES.length, 76);
  assert.deepEqual(new Set(BUILDING_TYPES.map(type => type.id)).size, 76);
  assert.deepEqual(new Set(Object.keys(windows)), new Set(BUILDING_TYPES.map(type => type.path)));
  const ids = new Set();
  for (const type of BUILDING_TYPES) {
    assert.ok(existsSync(new URL(`../public/assets/${type.path}.glb`, import.meta.url)), type.path);
    if (type.name.startsWith('low-detail-')) assert.equal(windows[type.path].length, 0, type.path);
    else assert.ok(windows[type.path].length > 0, type.path);
    for (const [index, window] of windows[type.path].entries()) {
      assert.equal(window.id, `${type.id}-W${String(index + 1).padStart(2, '0')}`);
      assert.ok(!ids.has(window.id), window.id);
      ids.add(window.id);
      assert.ok(['+X', '-X', '+Z', '-Z'].includes(window.side));
      assert.ok(window.width > 0 && window.height > 0);
      assert.equal(window.corners.length, 4);
      assert.ok([...window.center, ...window.corners.flat()].every(Number.isFinite));
      const fixedAxis = window.side.endsWith('X') ? 0 : 2;
      assert.ok(window.corners.every(corner => corner[fixedAxis] === window.center[fixedAxis]));
    }
  }
  assert.equal(ids.size, 751);
});
