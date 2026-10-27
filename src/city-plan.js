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
let house = 0;
for (const z of [-46,-12.5,21.5,54]) {
  for (const dz of [-5,5]) site('suburban',`building-type-${houseTypes[house++ % houseTypes.length]}`,-98,z+dz,6.6,12,8);
}
for (const z of [-46,-12.5]) for (const x of [-72,-62]) {
  for (const dz of [-5.1,5.1]) site('suburban',`building-type-${houseTypes[house++ % houseTypes.length]}`,x,z+dz,6.8,8,8,Math.PI);
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
for (const z of [21.5,54]) for (const x of [95,103]) for (const dz of [-5,5]) {
  site('suburban',`building-type-${houseTypes[house++ % houseTypes.length]}`,x,z+dz,5.3,6.5,8);
}

export const CIVIC_ENVELOPES = [
  {name:'town hall',x:0,z:-15,width:22,depth:17},
  {name:'museum',x:35,z:-47,width:21,depth:18},
  {name:'fire station',x:35,z:21,width:21,depth:22},
  {name:'school',x:-67,z:21,width:20,depth:17},
  {name:'hospital',x:-67,z:54,width:20,depth:18},
  {name:'town square',x:0,z:21,width:22,depth:22},
];
