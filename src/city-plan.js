import { BUILDING_TYPES_BY_PATH } from './building-catalog.js';
import { NEW_DISTRICTS } from './districts.js';

// Building envelopes leave the streets, sidewalks, and civic entrances clear.
export const BUILDING_SITES = [];
let nextWorldBuildingId = 1;
function site(pack, name, x, z, scale, width, depth, rotation = 0, questName = null) {
  // Chimneys and tanks occupy lots too, but they are props, not fireable buildings.
  const worldBuildingId = (pack === 'civic' || BUILDING_TYPES_BY_PATH.has(`${pack}/${name}`))
    ? `WB-${String(nextWorldBuildingId++).padStart(3, '0')}` : null;
  BUILDING_SITES.push({ worldBuildingId, pack, name, x, z, scale, width, depth, rotation, questName });
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
  const width=(Math.abs(Math.cos(rotation))*sourceWidth+Math.abs(Math.sin(rotation))*sourceDepth)*SUBURBAN_HOUSE_SCALE+.1;
  const depth=(Math.abs(Math.sin(rotation))*sourceWidth+Math.abs(Math.cos(rotation))*sourceDepth)*SUBURBAN_HOUSE_SCALE+.1;
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

// Mission landmarks now span the original town and the new neighborhoods.
// Every moved landmark sits near a street-facing sidewalk.
export const QUEST_BUILDINGS = [
  ['civic','barn',-98,-219,1,14,16,'Sunny Farm Barn'],
  ['civic','farmhouse',-67,-219,1,15,16,'Sunny Farmhouse'],
  ['commercial','building-i',-35,-355,8.5,17,16,'Neighborhood Clinic'],
  ['commercial','building-j',35,-525,8.5,17,16,'Market Hall'],
  ['commercial','building-k',0,-457,8.5,17,16,'Preschool'],
  ['industrial','building-m',105,-389,8.2,18,17,'Post Office Depot'],
  ['commercial','building-skyscraper-e',104,-319,8.5,12.5,12.5,'Apartment Courtyard'],
  ['commercial','building-d',68,-456,8.5,12.5,12.5,'Elementary School'],
  ['commercial','building-e',-35,-457,8.5,17,17,'Primary School Cafeteria'],
  ['industrial','building-n',0,-185,8.2,17,17,'Fire Station Annex'],
  ['commercial','building-skyscraper-a',68,-319,8.5,12.5,12.5,'Old Clocktower'],
  ['industrial','building-g',105,-151,8.2,18,17,'Canal Workshop'],
  ['industrial','building-h',68,-151,8.2,17,17,'Building Site'],
  ['commercial','building-c',0,-321,8.5,17,17,'Granny Cheetah Apartments'],
  ['civic','picnic-pavilion',-98,-151,1,14,14,'Riverside Picnic Pavilion'],
  ['civic','town-library',-35,-77,1,21,12,'Town Library'],
  ['civic','sports-center',35,-77,1,23,13,'Sports Center'],
];
for (const [pack,name,x,z,scale,width,depth,questName] of QUEST_BUILDINGS) site(pack,name,x,z,scale,width,depth,0,questName);
// The southern edge of the extension forms a lived-in transition back to the
// original center rather than a row of empty blocks.
houseSite('n',-98,-117);
houseSite('o',-67,-117);
site('commercial','building-m',-35,-117,8.5,17,17);
site('commercial','building-n',0,-117,8.5,17,17);
site('commercial','building-f',35,-117,8.5,17,17);
site('industrial','building-p',68,-117,8.2,17,17);
houseSite('p',105,-117);
site('commercial','building-g',-35,-151,8.5,17,17);
site('commercial','building-h',68,-219,8.5,17,17);
// Shops take the former clinic/market/preschool lots, keeping North Town busy.
site('commercial','building-m',-35,-219,8.5,17,16);
site('commercial','building-n',0,-219,8.5,17,16);
site('commercial','building-f',35,-219,8.5,17,16);

// The narrow transition block is inhabited too: it no longer leaves a blank
// row between Sunny Farm / North Town and the first northern neighborhoods.
for (const [x,z,type] of [
  [-98,-259,'a'],[-98,-247,'c'],[-67,-253,'h'],[-35,-253,'k'],[0,-253,'l'],
  [35,-253,'p'],[68,-253,'q'],[105,-253,'a'],
]) houseSite(type,x,z);

// Crowdie has three distinct tight clusters instead of one house per lot.
export const CROWDIE_HOUSE_GROUPS = Object.freeze([
  [[-109,-318],[-97,-318],[-109,-304],[-97,-304]],
  [[-73,-321],[-61,-321],[-73,-309],[-61,-309],[-73,-297],[-61,-297]],
  [[-42,-321],[-30,-321],[-42,-309],[-30,-309],[-42,-297],[-30,-297],[-42,-285]],
]);
const compactHomes = ['a','c','h','k','l','p','q'];
let newHomeIndex = 0;
for (const group of CROWDIE_HOUSE_GROUPS) for (const [x,z] of group) {
  houseSite(compactHomes[newHomeIndex++ % compactHomes.length],x,z);
}

// Crowdiecity's seven tall buildings make a real U: two continuous legs and
// a three-tower base, with a clear open court between the upper legs.
export const CROWDIECITY_TOWERS = Object.freeze([
  [68,-319],[104,-319],[68,-303],[104,-303],[68,-287],[86,-287],[104,-287],
]);
for (const [x,z] of CROWDIECITY_TOWERS) {
  if (BUILDING_SITES.some(entry => entry.x === x && entry.z === z)) continue;
  site('commercial',`building-skyscraper-${newHomeIndex++ % 2 ? 'b' : 'd'}`,x,z,8.5,12.5,12.5);
}
for (const z of [-321,-303,-285]) site('commercial',`building-${newHomeIndex++ % 2 ? 'f' : 'g'}`,35,z,8.5,12.5,12.5);

// Skyline Court gets the turned H from the user's sketch: two three-building
// arms and one center connector, all within the same large parcel.
export const SKYLINE_H_TOWERS = Object.freeze([
  [68,-456],[104,-456],[68,-440],[86,-440],[104,-440],[68,-424],[104,-424],
]);
for (const [x,z] of SKYLINE_H_TOWERS) {
  if (BUILDING_SITES.some(entry => entry.x === x && entry.z === z)) continue;
  site('commercial',`building-skyscraper-${newHomeIndex++ % 2 ? 'b' : 'd'}`,x,z,8.5,12.5,12.5);
}
for (const z of [-457,-423]) site('commercial','building-skyscraper-e',35,z,8.5,17,17);

// Brickworks mixes rows of workshops with smaller sheds; Market Mile groups
// shops around its local street rather than scattering them across empty cells.
for (const [pack,name,x,z,scale,width,depth] of [
  ['industrial','building-p',35,-389,8.2,17,17],
  ['industrial','building-q',35,-355,8.2,17,17],
  ['industrial','building-r',68,-355,8.2,17,17],
  ['industrial','building-s',105,-355,8.2,17,17],
  ['industrial','building-t',105,-372,8.2,12.5,12.5],
  ['industrial','building-q',122,-389,8.2,12.5,12.5],
  ['industrial','building-o',122,-355,8.2,12.5,12.5],
  ['commercial','building-f',68,-525,8.5,12.5,13],
  ['commercial','building-g',85,-525,8.5,12.5,13],
  ['commercial','building-h',102,-525,8.5,12.5,13],
  ['commercial','building-k',68,-491,8.5,12.5,13],
  ['commercial','building-m',85,-491,8.5,12.5,13],
  ['commercial','building-n',102,-491,8.5,12.5,13],
]) site(pack,name,x,z,scale,width,depth);

// Street-facing rows sit just behind the sidewalks, using the same authored
// house scale as the rest of town. Local +Z is the entrance side.
//
// The homes at the southwest bend deliberately follow the curve instead of
// making a square block. The west-edge row faces east toward the avenue and
// fills the small residential strip between it and the edge of the world.
export const GANTON_TURN_HOMES = Object.freeze([
  [-123.5,-544,-Math.PI/4],
  [-122,-556,-Math.PI/4],
]);
export const GANTON_WEST_EDGE_HOMES = Object.freeze([
  [-124,-520,Math.PI/2],[-124,-505,Math.PI/2],[-124,-490,Math.PI/2],
  [-124,-475,Math.PI/2],[-124,-460,Math.PI/2],
]);
export const GANTON_HOMES = Object.freeze([
  ...[-94,-83,-72,-61,-50,-39].map(x => [x,-553,0]),
  ...[-94,-83,-72,-61,-50,-39].map(x => [x,-531,Math.PI]),
  ...[-519,-507,-495,-483].map(z => [-101,z,-Math.PI/2]),
  ...[-519,-507,-495,-483].map(z => [-29,z,Math.PI/2]),
  ...[-531,-519,-507,-495,-485].map(z => [-7,z,-Math.PI/2]),
  ...GANTON_TURN_HOMES,
  ...GANTON_WEST_EDGE_HOMES,
]);
for (const [x,z,rotation=0] of GANTON_HOMES) houseSite(compactHomes[newHomeIndex++ % compactHomes.length],x,z,rotation);

for (const [x,z] of [
  [-112,-389],[-98,-389],[-82,-389],[-67,-389],[-35,-389],[0,-389],
  [-112,-355],[-98,-355],[-82,-355],[-67,-355],[0,-355],
  [-35,-423],[0,-423],
]) houseSite(compactHomes[newHomeIndex++ % compactHomes.length],x,z);

export const NEIGHBORHOOD_PARKS = Object.freeze([
  {name:'Cedar Green',x:-84,z:-463,radius:17},
  {name:'Ganton Grove',x:-84,z:-491,radius:11},
]);

export const EXPANSION_LANDMARKS = NEW_DISTRICTS.map(district => ({
  title: district.name.toUpperCase(), x: district.center[0], z: district.center[1],
}));

export const CIVIC_ENVELOPES = [
  {name:'town hall',x:0,z:-15,width:22,depth:17},
  {name:'museum',x:35,z:-47,width:21,depth:18},
  {name:'fire station',x:35,z:21,width:21,depth:22},
  {name:'school',x:-67,z:21,width:20,depth:17},
  {name:'hospital',x:-67,z:54,width:20,depth:18},
  {name:'town square',x:0,z:21,width:22,depth:22},
  {name:'Farm Fields',x:-98,z:-185,width:14,depth:16},
  {name:'Farm Pond',x:-67,z:-185,width:15,depth:16},
  {name:'North Playground',x:35,z:-151,width:17,depth:17},
  {name:'Sports Park',x:-67,z:-151,width:16,depth:17},
];
