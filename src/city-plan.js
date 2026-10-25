// Building envelopes leave the streets, sidewalks, and civic entrances clear.
export const BUILDING_SITES = [];
function site(pack, name, x, z, scale, width, depth, rotation = 0) {
  BUILDING_SITES.push({ pack, name, x, z, scale, width, depth, rotation });
}

const houseTypes = ['a','e','c','l','g','q','m','u','f','r','k','b'];
let house = 0;
for (const z of [-46,-12.5,21.5,54]) {
  for (const dz of [-5,5]) site('suburban',`building-type-${houseTypes[house++ % houseTypes.length]}`,-98,z+dz,6.6,12,8);
}
for (const z of [-46,-12.5]) for (const x of [-72,-62]) {
  for (const dz of [-5.1,5.1]) site('suburban',`building-type-${houseTypes[house++ % houseTypes.length]}`,x,z+dz,6.8,8,8,Math.PI);
}

for (const [z,a,b] of [[-46,'skyscraper-e','skyscraper-b'],[-12.5,'skyscraper-a','skyscraper-c'],[21.5,'f','k'],[54,'j','e']]) {
  site('commercial',`building-${a}`,-39.5,z,7.8,8.6,15);
  site('commercial',`building-${b}`,-29.5,z,7.4,8.6,15,Math.PI);
}
site('commercial','building-skyscraper-d',-5.6,-46,8.2,9.4,16);
site('commercial','building-skyscraper-b',5.6,-46,8.6,9.4,16);
for (const z of [-12.5,54]) {
  site('commercial','building-skyscraper-a',29.5,z,7.5,8.8,15);
  site('commercial','building-skyscraper-c',40.5,z,7,8.8,15);
}
site('commercial','building-a',-6.5,54,7,8,13);
site('commercial','building-h',5,51,6.7,8,9);

for (const [z,name] of [[-46,'a'],[-12.5,'c'],[21.5,'e'],[54,'o']]) {
  site('industrial',`building-${name}`,66,z,8.2,13,15);
  site('industrial','chimney-large',76,z-4,6,3.2,3.2);
  site('industrial','detail-tank',76,z+4.8,6,3.2,4.2);
}
site('industrial','building-b',99,-46,8.5,13.5,16);
site('industrial','building-i',99,-12.5,8,13.5,17);
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
