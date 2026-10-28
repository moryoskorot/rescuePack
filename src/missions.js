import library from '../docs/rescue-pack-missions.json' with { type: 'json' };
import { surfaceAt } from './world-layout.js';

// These are authored, drivable prototype points in the current city. The draft
// destination IDs remain in the library until their own locations are built.
const locations = {
  pig_01: { label: 'Pig’s garden cottage · Sunny Farm prototype', target: { x: -98, z: -51 }, fireSite: { x: -98, z: -51 } },
  horse_02: { label: 'School gym entrance · Sports Center prototype', target: { x: -67, z: 32.5 } },
  sheep_03: {
    label: 'School library return · Library Neighborhood prototype',
    target: { x: -67, z: 32.5 },
    pickups: [
      { x: -44.9, z: -12 }, { x: -57.2, z: -12 },
      { x: -44.9, z: 21 }, { x: -57.2, z: 21 },
      { x: -44.9, z: 54 }, { x: -57.2, z: 54 },
    ],
  },
  bunny_02: { label: 'Harbor path · Pond Path prototype', target: { x: 12, z: 91 } },
};

export const PLAYABLE_MISSIONS = ['pig_01', 'horse_02', 'sheep_03', 'bunny_02'].map(id => ({
  ...library.missions.find(mission => mission.id === id),
  ...locations[id],
}));

export function validateMissionPoints(mission) {
  const points = mission.pickups ?? [];
  if (points.length !== (mission.mechanics.item_count ?? points.length)) return false;
  const center = mission.target;
  const scatter = mission.mechanics.scatter;
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
    get collectedCount() { return collected.size; },
    get collected() { return new Set(collected); },
    update(position, fireOut = false) {
      if (stage === 'complete') return stage;
      if (mission.type === 'fire') {
        if (fireOut) stage = 'complete';
      } else if (mission.type === 'collect') {
        if (stage === 'collecting') {
          mission.pickups.forEach((point, index) => {
            if (Math.hypot(position.x - point.x, position.z - point.z) <= 5.5) collected.add(index);
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
