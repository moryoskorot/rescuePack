import library from '../docs/rescue-pack-missions.json' with { type: 'json' };
import { surfaceAt, STREET_Z } from './world-layout.js';
import { BUILDING_SITES } from './city-plan.js';
import { NEW_DISTRICTS, districtAt } from './districts.js';

// Entrances are on the street-facing sidewalk. Fire coordinates are the exact
// building sites, so missions never ignite a nearby unrelated building.
const destination = {
  riverside_picnic_park: [-98,-139.5,-98,-151], pond_path: [12,91],
  fire_station_yard: [35,32.7], neighborhood_clinic: [-35,-207.5,-35,-219],
  playground: [35,-139.5], clinic_and_market_streets: [-35,-207.5],
  canal_workshop: [105,-139.5,105,-151], canal_bridge: [119.5,-151],
  workshop_district: [105,-139.5], sunny_farm: [-98,-207.5,-98,-219],
  farm_pond: [-67,-173.5], farm_fields: [-98,-173.5],
  town_library: [-35,-67.7,-35,-77], library_neighborhood: [-35,-67.7],
  sports_center: [35,-67.7,35,-77], sports_park: [-67,-139.5],
  fire_station_annex: [0,-173.5,0,-185], town_hall: [0,-.7],
  town_center_loop: [0,10.5], post_office_depot: [105,-207.5,105,-219],
  apartment_courtyard: [105,-173.5], market_and_post_office: [105,-207.5],
  primary_school_cafeteria: [35,-173.5,35,-185], primary_school: [-67,32.5],
  school_grounds: [-67,32.5], preschool_garden: [35,-207.5,35,-219],
  preschool_playground: [35,-139.5], preschool_neighborhood: [35,-207.5],
  elementary_school: [68,-173.5,68,-185], school_neighborhood: [68,-173.5],
  old_clocktower: [-35,-173.5,-35,-185], museum_rooftop: [35,-35.4],
  town_square: [0,32.5], industrial_building_site: [68,-139.5,68,-151],
  industrial_footbridge: [90.5,-151], industrial_construction_zone: [68,-139.5],
  granny_cheetah_apartment: [0,-139.5,0,-151], park_and_apartment_blocks: [0,-139.5],
};

// Several named mission buildings moved into the expanded neighborhoods.
// Resolve their street-facing entrances from the building plan, so their
// driving markers and fire coordinates stay attached to the same landmark.
const relocatedDestinations = {
  neighborhood_clinic: 'Neighborhood Clinic', clinic_and_market_streets: 'Neighborhood Clinic',
  market_and_post_office: 'Post Office Depot', preschool_garden: 'Preschool',
  preschool_neighborhood: 'Preschool', post_office_depot: 'Post Office Depot',
  apartment_courtyard: 'Apartment Courtyard', elementary_school: 'Elementary School',
  school_neighborhood: 'Elementary School', primary_school_cafeteria: 'Primary School Cafeteria',
  old_clocktower: 'Old Clocktower', granny_cheetah_apartment: 'Granny Cheetah Apartments',
  park_and_apartment_blocks: 'Granny Cheetah Apartments',
};

function destinationFor(id) {
  const questName = relocatedDestinations[id];
  if (!questName) return destination[id];
  const site = BUILDING_SITES.find(candidate => candidate.questName === questName);
  if (!site) throw new Error(`Missing moved landmark: ${questName}`);
  return [site.x, site.z + 11.5, site.x, site.z];
}

const itemKinds = {
  bunny_03: ['nozzles','nozzle'], hawk_03: ['supply packs','pack'],
  beaver_03: ['gears','gear'], pig_03: ['carrots','carrot'],
  sheep_03: ['books','book'], horse_03: ['pom-poms','pompom'],
  pigeon_03: ['letters','letter'], koala_03: ['tools','tool'],
  fox_03: ['art packs','pack'], bear_03: ['shapes','shape'],
  crow_03: ['clue cards','card'], kangaroo_03: ['screw boxes','screw'],
  cheetah_03: ['postcards','card'],
};

const bookBoxes = [
  { x: -120, z: 43.7, count: 2, district: 'Suburbs' },
  { x: -24, z: -.7, count: 2, district: 'Downtown' },
  { x: 57.6, z: 10.6, count: 2, district: 'Industrial Yards' },
];
const nozzlePoints = [
  { x: 29, z: 30 }, { x: 41, z: 30 }, { x: 46.2, z: 43.7 },
  { x: 12.2, z: 43.7 }, { x: 29, z: 43.7 },
];

const streetCenters = [-98,-67,-35,0,35,68,105];
function scatteredPoints(center, count, seed) {
  const candidates = STREET_Z.flatMap(z => streetCenters.map(x => ({x,z:z-5.5})))
    .filter(point => surfaceAt(point.x,point.z) === 'pavement')
    .map(point => ({...point,distance:Math.hypot(point.x-center.x,point.z-center.z)}))
    .filter(point => point.distance >= 10 && point.distance <= 90)
    .sort((a,b) => a.distance-b.distance || a.x-b.x || a.z-b.z);
  // Rotate choices per mission so collection routes do not all reuse one row.
  const offset = seed % Math.max(1,candidates.length);
  const rotated = [...candidates.slice(offset),...candidates.slice(0,offset)];
  const selected = [];
  for (const point of rotated) {
    if (selected.every(other => Math.hypot(other.x-point.x,other.z-point.z)>=12)) selected.push({x:point.x,z:point.z});
    if (selected.length===count) break;
  }
  if (selected.length < count) throw new Error(`Only ${selected.length} reachable pickup points for ${count} items`);
  return selected;
}

const raceRoute = [
  {x:18,z:5},{x:18,z:38},{x:18,z:70},{x:-18,z:70},
  {x:-18,z:38},{x:-18,z:5},{x:0,z:5},{x:18,z:5},
];

export const PLAYABLE_MISSIONS = library.missions.map((mission,index) => {
  const position = destinationFor(mission.destination_id);
  if (!position) throw new Error(`Missing city destination for ${mission.id}`);
  const target = {x:position[0],z:position[1]};
  const result = { ...mission, label: mission.destination_label, target };
  if (position.length === 4) result.fireSite = {x:position[2],z:position[3]};
  if (mission.type === 'collect') {
    const [pickupLabel,markerKind] = itemKinds[mission.id];
    Object.assign(result,{pickupLabel,markerKind,returnLabel:mission.destination_label,
      pickups:mission.id==='sheep_03' ? bookBoxes : mission.id==='bunny_03' ? nozzlePoints
        : scatteredPoints(target,mission.mechanics.item_count,index*7+3),
      scatter:mission.id==='sheep_03' ? {...mission.mechanics.scatter,radius_m:205}
        : mission.id==='bunny_03' ? {...mission.mechanics.scatter,minimum_radius_m:5}
          : mission.mechanics.scatter,
    });
  }
  if (mission.type === 'race') result.route = raceRoute;
  return result;
});

export const GANTON_DELIVERY_MISSION = {
  id: 'pigeon_ganton_delivery', character_id: 'pigeon', type: 'delivery',
  title: 'A Ganton Delivery', label: 'Ganton', target: { x: -98, z: -570.5 },
  objective: 'Deliver the baseball bat to the Ganton corner',
  mechanics: { interaction: 'stop_to_deliver', hold_seconds: 2, target_marker: 'delivery' },
  dialogue: {
    start: [{ speaker: 'Pigeon', text: 'A parcel for Ganton! It says baseball bat. Can you take it to the little houses in the corner?', sprite: 'visuals/processed/PIGEON_2_deliver.png' }],
    success: [{ speaker: 'Pigeon', text: "They didn't strike me as baseball fans. No matter, delivery well made!", sprite: 'visuals/processed/PIGEON_1_idle.png' }],
    failure: [{ speaker: 'Pigeon', text: 'I can hold on to the parcel until we try again.', sprite: 'visuals/processed/PIGEON_1_idle.png' }],
  },
};

const FIRE_CALL_DISTRICTS = new Set([
  'Suburbs', 'Downtown', 'Industrial Yards', 'Parks District',
  'School District', 'Workshop District', 'North Town',
  ...NEW_DISTRICTS.map(district => district.name),
]);
const newDistrictNames = new Set(NEW_DISTRICTS.map(district => district.name));

const readableBuildingName = site => site.questName ?? site.name
  .replace(/^building-type-/, 'house ').replace(/^building-/, '')
  .replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());

const fireSitesByDistrict = BUILDING_SITES
  .filter(site => site.worldBuildingId && FIRE_CALL_DISTRICTS.has(districtAt(site)))
  .reduce((districts, site) => {
    const district = districtAt(site);
    (districts[district] ??= []).push(site);
    return districts;
  }, {});

const siteChoice = site => ({ x: site.x, z: site.z, worldBuildingId: site.worldBuildingId, label: readableBuildingName(site) });
const chiefDialogue = (text, success = 'Great work! The building is safe again.') => ({
  start: [{ speaker: 'Chief Panda', text, sprite: 'visuals/processed/PANDA_2_point.png' }],
  success: [{ speaker: 'Chief Panda', text: success, sprite: 'visuals/processed/PANDA_1_idle.png' }],
  failure: [{ speaker: 'Chief Panda', text: 'I have backup covering every building. We can answer another call together.', sprite: 'visuals/processed/PANDA_1_idle.png' }],
});

function fireMissionBlueprint(id, district, fireCount, candidates, title, opening) {
  return {
    id, character_id: 'panda', title, type: 'fire', district, label: district, fireCount,
    fireCandidates: candidates.map(siteChoice),
    objective: `Put out all ${fireCount} fires in the ${district}`,
    mechanics: { interaction: 'drive_to_site_then_extinguish_all', target_marker: 'fire' },
    dialogue: chiefDialogue(opening),
  };
}

// These calls keep a district roster, not a fixed building assignment. The
// actual burning buildings are randomly selected only when the phone rings.
export const FIRE_MISSIONS = Object.entries(fireSitesByDistrict).flatMap(([district, sites]) =>
  Array.from({ length: newDistrictNames.has(district) ? 4 : 3 }, (_, index) => fireMissionBlueprint(
    `chief-fire-${district.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index + 1}`,
    district, 1, sites, `Fire in ${district}`,
    `A fire started in the ${district}. They need you there quickly!`,
  )),
);

export const MULTI_FIRE_MISSIONS = Object.entries(fireSitesByDistrict).flatMap(([district, sites]) =>
  Array.from({ length: newDistrictNames.has(district) ? 4 : 1 }, (_, index) => fireMissionBlueprint(
    `chief-multiple-fires-${district.toLowerCase().replace(/[^a-z0-9]+/g, '-')}${newDistrictNames.has(district) ? `-${index + 1}` : ''}`,
    district, index % 2 === 0 ? 2 : 3, sites, `Multiple fires in ${district}`,
    `Multiple fires started in the ${district}! We need you there quickly!`,
  )),
);

export const CITYWIDE_FIRE_MISSION = fireMissionBlueprint(
  'chief-fire-fire-fire-fire-aahhh', 'Citywide', 10,
  BUILDING_SITES.filter(site => site.worldBuildingId), 'FIRE FIRE FIRE FIRE AAHHHH!',
  'FIRE FIRE FIRE FIRE AAHHHH! Ten buildings are on fire around the city!',
);

export function materializeFireMission(mission, random = Math.random) {
  if (!mission.fireCandidates) return mission;
  const choices = [...mission.fireCandidates];
  for (let index = choices.length - 1; index > 0; index--) {
    const pick = Math.floor(random() * (index + 1));
    [choices[index], choices[pick]] = [choices[pick], choices[index]];
  }
  const fireSites = choices.slice(0, mission.fireCount);
  const buildingNames = fireSites.map(site => site.label).join(', ');
  const isCitywide = mission.district === 'Citywide';
  const isMultiple = fireSites.length > 1;
  const text = isCitywide ? `FIRE FIRE FIRE FIRE AAHHHH! ${buildingNames} need you now!`
    : isMultiple ? `Multiple fires started in the ${mission.district}: ${buildingNames}! We need you there quickly!`
      : `A fire started in the ${mission.district}, at the ${buildingNames}. They need you there quickly!`;
  return {
    ...mission,
    label: isCitywide ? 'All around the city' : buildingNames,
    target: { x: fireSites[0].x, z: fireSites[0].z },
    fireSite: fireSites[0],
    fireSites,
    objective: `Put out all ${fireSites.length} fires${isCitywide ? ' around the city' : ` in the ${mission.district}`}`,
    dialogue: chiefDialogue(text, isMultiple ? 'Every fire is out. Outstanding teamwork!' : undefined),
  };
}

export function validateMissionPoints(mission) {
  if (mission.type === 'fire') {
    if (mission.fireCandidates) return mission.fireCandidates.length >= mission.fireCount
      && new Set(mission.fireCandidates.map(site => site.worldBuildingId)).size === mission.fireCandidates.length;
    if (!mission.fireSites) return BUILDING_SITES.some(site => site.worldBuildingId
      && site.x === mission.fireSite?.x && site.z === mission.fireSite?.z);
    return mission.fireSites.length > 0
      && new Set(mission.fireSites.map(site => site.worldBuildingId)).size === mission.fireSites.length
      && mission.fireSites.every(fireSite => BUILDING_SITES.some(site => site.worldBuildingId === fireSite.worldBuildingId
        && site.x === fireSite.x && site.z === fireSite.z));
  }
  if (mission.type === 'race') return mission.route?.length === mission.mechanics.checkpoint_count
    && mission.route.every(point => surfaceAt(point.x,point.z) === 'road');
  if (!['pavement', 'driveway', 'deck'].includes(surfaceAt(mission.target.x, mission.target.z))) return false;
  const points = mission.pickups ?? [];
  if (points.reduce((sum, point) => sum + (point.count ?? 1), 0) !== (mission.mechanics.item_count ?? points.length)) return false;
  const center = mission.target;
  const scatter = mission.scatter ?? mission.mechanics.scatter;
  return points.every((point, index) => {
    const surface = surfaceAt(point.x, point.z);
    const radius = Math.hypot(point.x - center.x, point.z - center.z);
    return ['pavement', 'driveway', 'deck'].includes(surface)
      && (!scatter || (radius >= scatter.minimum_radius_m && radius <= scatter.radius_m))
      && points.slice(0, index).every(other => Math.hypot(point.x - other.x, point.z - other.z) >= (scatter?.minimum_item_separation_m ?? 0));
  });
}

export function createMissionProgress(mission) {
  const collected = new Set();
  let stage = mission.type === 'collect' ? 'collecting' : mission.type === 'race' ? 'racing' : 'going';
  let checkpoint = 0;
  let holdSeconds = 0;
  const holdDuration = ['collect', 'rescue', 'delivery'].includes(mission.type) ? 2 : mission.type === 'fix' ? 6 : 0;
  return {
    get stage() { return stage; },
    get checkpoint() { return checkpoint; },
    get holdSeconds() { return holdSeconds; },
    get holdDuration() { return holdDuration; },
    get holdProgress() { return holdDuration ? Math.min(holdSeconds / holdDuration, 1) : 0; },
    get collectedCount() { return mission.type === 'race' ? checkpoint : [...collected].reduce((sum, index) => sum + (mission.pickups[index].count ?? 1), 0); },
    get collected() { return new Set(collected); },
    update(position, fireOut = false, dt = 0) {
      if (stage === 'complete') return stage;
      const atTarget = Math.hypot(position.x - mission.target.x, position.z - mission.target.z) <= 7;
      const holdingStill = atTarget && (position.speed ?? 0) <= 1;
      if (mission.type === 'fire') {
        if (fireOut) stage = 'complete';
      } else if (mission.type === 'race') {
        const point = mission.route[checkpoint];
        if (point && Math.hypot(position.x-point.x,position.z-point.z)<=6) checkpoint++;
        if (checkpoint === mission.route.length) stage = 'complete';
      } else if (mission.type === 'collect') {
        if (stage === 'collecting') {
          mission.pickups.forEach((point, index) => {
            if (Math.hypot(position.x - point.x, position.z - point.z) <= 4.5) collected.add(index);
          });
          if (collected.size === mission.pickups.length) stage = 'returning';
        } else {
          holdSeconds = holdingStill ? holdSeconds + Math.max(0, dt) : 0;
          if (holdSeconds >= holdDuration) stage = 'complete';
        }
      } else if (mission.type === 'fix' || mission.type === 'rescue' || mission.type === 'delivery') {
        holdSeconds = holdingStill ? holdSeconds + Math.max(0, dt) : 0;
        if (holdSeconds >= holdDuration) stage = 'complete';
      } else if (atTarget) {
        stage = 'complete';
      }
      return stage;
    },
  };
}
