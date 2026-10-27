import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUILDING_SITES, CIVIC_ENVELOPES, SUBURBAN_HOUSE_SCALE, SUBURBAN_MODEL_FOOTPRINTS } from '../src/city-plan.js';
import { isRoad, isReserved, insideRect, LAND_BOUNDS } from '../src/world-layout.js';

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

test('every suburban house uses the same source scale and fits its full model in its lot', () => {
  for (const site of BUILDING_SITES.filter(site => site.pack === 'suburban')) {
    assert.equal(site.scale,SUBURBAN_HOUSE_SCALE,site.name);
    const type=site.name.at(-1);
    const glb=readFileSync(new URL(`../public/assets/suburban/${site.name}.glb`,import.meta.url));
    const jsonLength=glb.readUInt32LE(12);
    const gltf=JSON.parse(glb.subarray(20,20+jsonLength).toString());
    const position=gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION];
    const sourceWidth=position.max[0]-position.min[0];
    const sourceDepth=position.max[2]-position.min[2];
    assert.ok(Math.abs(sourceWidth-SUBURBAN_MODEL_FOOTPRINTS[type][0])<.005,`${site.name} source width changed`);
    assert.ok(Math.abs(sourceDepth-SUBURBAN_MODEL_FOOTPRINTS[type][1])<.005,`${site.name} source depth changed`);
    const rotated=Math.abs(Math.sin(site.rotation))>.5;
    assert.ok(site.width>=(rotated?sourceDepth:sourceWidth)*site.scale,`${site.name} is squeezed across its lot`);
    assert.ok(site.depth>=(rotated?sourceWidth:sourceDepth)*site.scale,`${site.name} is squeezed along its lot`);
    for(let x=site.x-site.width/2;x<=site.x+site.width/2;x+=.25) for(let z=site.z-site.depth/2;z<=site.z+site.depth/2;z+=.25) {
      assert.ok(insideRect(x,z,LAND_BOUNDS),`${site.name} extends off land`);
      assert.equal(isReserved(x,z),false,`${site.name} occupies sidewalk at ${x},${z}`);
    }
  }
});
