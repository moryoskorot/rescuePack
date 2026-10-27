import { BUILDING_TYPES_BY_PATH } from './building-catalog.js';

// Building envelopes leave the streets, sidewalks, and civic entrances clear.
export const BUILDING_SITES = [];
let nextWorldBuildingId = 1;
function site(pack, name, x, z, scale, width, depth, rotation = 0) {
  // Chimneys and tanks occupy lots too, but they are props, not fireable buildings.
  const worldBuildingId = BUILDING_TYPES_BY_PATH.has(`${pack}/${name}`)
    ? `WB-${String(nextWorldBuildingId++).padStart(3, '0')}` : null;
  BUILDING_SITES.push({ worldBuildingId, pack, name, x, z, scale, width, depth, rotation });
}

const houseTypes = ['a','e','c','l','g','q','m','u','f','r','k','b'];
// The suburban pack shares one authored scale for its doors, windows, and
// landscaping. Keep every house at this scale; provide larger lots instead of
// shrinking a model to its assigned envelope.
export const SUBURBAN_HOUSE_SCALE = 6.6;
// X/Z bounds measured from the suburban GLBs. These include their shrubs,
// porches and roof overhangs, so lot sizes track the actual source models.
export const SUBURBAN_MODEL_FOOTPRINTS = Object.freeze({
  a:[1.300,1.028], b:[1.828,1.140], c:[1.286,1.028], d:[1.756,1.028],
  e:[1.300,1.028], f:[1.428,1.406], g:[1.450,1.178], h:[1.300,.916],
  i:[1.286,1.028], j:[1.370,.916], k:[.921,1.020], l:[1.034,1.020],
  m:[1.428,1.428], n:[1.784,1.378], o:[1.270,1.028], p:[1.240,.990],
  q:[1.240,.886], r:[1.028,1.020], s:[1.406,1.086], t:[1.314,1.406],
  u:[1.428,1.087],
});
function houseSite(type,x,z,rotation=0) {
  const [sourceWidth,sourceDepth]=SUBURBAN_MODEL_FOOTPRINTS[type];
  const quarterTurn=Math.abs(Math.sin(rotation))>.5;
  const width=(quarterTurn?sourceDepth:sourceWidth)*SUBURBAN_HOUSE_SCALE+.1;
  const depth=(quarterTurn?sourceWidth:sourceDepth)*SUBURBAN_HOUSE_SCALE+.1;
  site('suburban',`building-type-${type}`,x,z,SUBURBAN_HOUSE_SCALE,width,depth,rotation);
}
let house = 0;
for (const [firstZ,secondZ] of [[-51,-41],[-17.5,-7.5],[16.5,26.5],[49.1,59]]) {
  houseSite(houseTypes[house++ % houseTypes.length],-98,firstZ);
  houseSite(houseTypes[house++ % houseTypes.length],-98,secondZ);
}
// The wide second house in the first block needs more room away from the curb.
for (const [firstX,secondX,firstZ,secondZ] of [
  [-72,-74,-50.9,-40.9],[-62,-64,-50.9,-40.9],
  [-74,-74,-17.6,-7.4],[-64,-64,-17.6,-7.4],
]) {
  houseSite(houseTypes[house++ % houseTypes.length],firstX,firstZ,Math.PI);
  houseSite(houseTypes[house++ % houseTypes.length],secondX,secondZ,Math.PI);
}

// Paired buildings share a street wall and similarly sized lots. The shorter
// downtown models get enough width and height to read as multi-storey buildings.
for (const [z,a,b] of [[-46,'skyscraper-e','skyscraper-b'],[-12.5,'skyscraper-d','skyscraper-e'],[21.5,'f','g'],[54,'a','b']]) {
  const scale = z < 0 ? 8.5 : 10.4;
  site('commercial',`building-${a}`,-40.2,z,scale,10.8,15.5);
  site('commercial',`building-${b}`,-28.8,z,scale,10.8,15.5,Math.PI);
}
site('commercial','building-skyscraper-d',-6.5,-46,8.2,11.5,16);
site('commercial','building-skyscraper-b',6.5,-46,8.6,11.5,16);
for (const z of [-12.5,54]) {
  site('commercial','building-skyscraper-b',29,z,8.5,11.2,15.5);
  site('commercial','building-skyscraper-d',41,z,8.3,11.2,15.5);
}
site('commercial','building-a',-6.5,54,11.5,11.5,13);
site('commercial','building-h',6.5,54,11.5,11.5,13);

for (const [z,name] of [[-46,'a'],[-12.5,'c'],[21.5,'e'],[54,'f']]) {
  site('industrial',`building-${name}`,66,z,8.2,13,15);
  site('industrial','chimney-large',76,z-4,6,3.2,3.2);
  site('industrial','detail-tank',76,z+4.8,6,3.2,4.2);
}
site('industrial','building-b',99,-46,8.5,13.5,16);
site('industrial','building-l',99,-12.5,8,13.5,17);
for (const z of [21.5,54]) for (const x of [99,111]) for (const dz of [-5,5]) {
  houseSite(houseTypes[house++ % houseTypes.length],x,z+dz);
}

export const CIVIC_ENVELOPES = [
  {name:'town hall',x:0,z:-15,width:22,depth:17},
  {name:'museum',x:35,z:-47,width:21,depth:18},
  {name:'fire station',x:35,z:21,width:21,depth:22},
  {name:'school',x:-67,z:21,width:20,depth:17},
  {name:'hospital',x:-67,z:54,width:20,depth:18},
  {name:'town square',x:0,z:21,width:22,depth:22},
];
