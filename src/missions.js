import library from '../docs/rescue-pack-missions.json' with { type: 'json' };
import { surfaceAt, STREET_Z } from './world-layout.js';
import { BUILDING_SITES } from './city-plan.js';

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
  const position = destination[mission.destination_id];
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

export function validateMissionPoints(mission) {
  if (mission.type === 'fire') {
    return BUILDING_SITES.some(site => site.worldBuildingId && site.x === mission.fireSite?.x && site.z === mission.fireSite?.z);
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
  const holdDuration = mission.type === 'collect' || mission.type === 'rescue' ? 2 : mission.type === 'fix' ? 6 : 0;
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
      } else if (mission.type === 'fix' || mission.type === 'rescue') {
        holdSeconds = holdingStill ? holdSeconds + Math.max(0, dt) : 0;
        if (holdSeconds >= holdDuration) stage = 'complete';
      } else if (atTarget) {
        stage = 'complete';
      }
      return stage;
    },
  };
}
