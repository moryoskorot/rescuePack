import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDING_SITES, CIVIC_ENVELOPES } from '../src/city-plan.js';
import { isRoad } from '../src/world-layout.js';

test('every building envelope and civic footprint stays out of all traffic lanes', () => {
  for (const site of [...BUILDING_SITES, ...CIVIC_ENVELOPES]) {
    // Sample the full envelope, so a road crossing through its center is caught.
    for (let x = site.x-site.width/2; x <= site.x+site.width/2; x += .5) {
      for (let z = site.z-site.depth/2; z <= site.z+site.depth/2; z += .5) {
        assert.equal(isRoad(x,z,.15),false,`${site.name} intrudes on a road at ${x},${z}`);
      }
    }
  }
});

test('buildings and civic sites have separate lots without overlapping envelopes', () => {
  const sites = [...BUILDING_SITES, ...CIVIC_ENVELOPES];
  for (let i=0;i<sites.length;i++) for (let j=i+1;j<sites.length;j++) {
    const a=sites[i], b=sites[j];
    const overlaps=Math.abs(a.x-b.x)<(a.width+b.width)/2 && Math.abs(a.z-b.z)<(a.depth+b.depth)/2;
    assert.equal(overlaps,false,`${a.name} overlaps ${b.name} at ${a.x},${a.z}`);
  }
});
