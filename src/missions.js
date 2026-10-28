import library from '../docs/rescue-pack-missions.json' with { type: 'json' };
import { surfaceAt } from './world-layout.js';
import { BUILDING_SITES } from './city-plan.js';

// Authored points use real roads and entrances in the current city. When the
// draft destination has no building yet, the phone describes the prototype.
const locations = {
  pig_01: { label: 'Pig’s garden cottage · Sunny Farm prototype', target: { x: -98, z: -51 }, fireSite: { x: -98, z: -51 } },
  horse_02: { label: 'Sports Center gym', target: { x: 35, z: -67.7 } },
  sheep_03: {
    label: 'Town Library · books at three district return boxes',
    target: { x: -35, z: -67.7 },
    pickupLabel: 'books', returnLabel: 'Town Library', markerKind: 'book',
    scatter: { minimum_radius_m: 10, radius_m: 205, minimum_item_separation_m: 12 },
    pickups: [
      { x: -120, z: 43.7, count: 2, district: 'Suburbs' },
      { x: -24, z: -.7, count: 2, district: 'Downtown' },
      { x: 57.6, z: 10.6, count: 2, district: 'Industrial Yards' },
    ],
  },
  bunny_02: { label: 'Harbor path · Pond Path prototype', target: { x: 12, z: 91 } },
  bunny_03: {
    label: 'Fire Station Yard', target: { x: 35, z: 32.7 },
    pickupLabel: 'nozzles', returnLabel: 'Fire Station',
    scatter: { minimum_radius_m: 5, radius_m: 90, minimum_item_separation_m: 12 },
    pickups: [
      { x: 29, z: 30 }, { x: 41, z: 30 }, { x: 46.2, z: 43.7 },
      { x: 12.2, z: 43.7 }, { x: 29, z: 43.7 },
    ],
  },
  hawk_01: { label: 'Clinic block near Hospital · prototype', target: { x: -40.2, z: 54 }, fireSite: { x: -40.2, z: 54 } },
  beaver_01: { label: 'Canal Workshop · Industrial Yards prototype', target: { x: 66, z: -46 }, fireSite: { x: 66, z: -46 } },
  pigeon_01: { label: 'Mail Depot · Industrial Yards prototype', target: { x: 99, z: -46 }, fireSite: { x: 99, z: -46 } },
  panda_02: { label: 'Town Hall roof access', target: { x: 0, z: -.7 } },
  crow_02: { label: 'Museum roof access', target: { x: 35, z: -35.4 } },
  koala_02: { label: 'School entrance · sink repair prototype', target: { x: -67, z: 32.5 } },
  kangaroo_02: { label: 'Industrial footbridge', target: { x: 90.7, z: -23 } },
  cheetah_02: { label: 'Apartment lobby · Downtown', target: { x: 6.5, z: 43.7 } },
  fox_02: { label: 'Preschool playground · Suburbs prototype', target: { x: -98, z: 32.4 } },
};

const playableIds = [
  'pig_01', 'horse_02', 'sheep_03', 'bunny_02',
  'bunny_03', 'hawk_01', 'beaver_01', 'pigeon_01',
  'panda_02', 'crow_02', 'koala_02', 'kangaroo_02',
  'cheetah_02', 'fox_02',
];

export const PLAYABLE_MISSIONS = playableIds.map(id => ({
  ...library.missions.find(mission => mission.id === id),
  ...locations[id],
}));

export function validateMissionPoints(mission) {
  if (mission.type === 'fire') {
    return BUILDING_SITES.some(site => site.worldBuildingId && site.x === mission.fireSite?.x && site.z === mission.fireSite?.z);
  }
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
  let stage = mission.type === 'collect' ? 'collecting' : 'going';
  return {
    get stage() { return stage; },
    get collectedCount() { return [...collected].reduce((sum, index) => sum + (mission.pickups[index].count ?? 1), 0); },
    get collected() { return new Set(collected); },
    update(position, fireOut = false) {
      if (stage === 'complete') return stage;
      if (mission.type === 'fire') {
        if (fireOut) stage = 'complete';
      } else if (mission.type === 'collect') {
        if (stage === 'collecting') {
          mission.pickups.forEach((point, index) => {
            if (Math.hypot(position.x - point.x, position.z - point.z) <= 4.5) collected.add(index);
          });
          if (collected.size === mission.pickups.length) stage = 'returning';
        } else if (Math.hypot(position.x - mission.target.x, position.z - mission.target.z) <= 7) stage = 'complete';
      } else if (Math.hypot(position.x - mission.target.x, position.z - mission.target.z) <= 7) {
        stage = 'complete';
      }
      return stage;
    },
  };
}
