// The northern neighborhoods share boundaries with the street grid. Keeping
// this map in one place makes the HUD and fire dispatch use the same district.
export const NEW_DISTRICTS = Object.freeze([
  { name: 'Crowdie', side: 'west', minZ: -338, maxZ: -270, center: [-72, -304] },
  { name: 'Crowdiecity', side: 'east', minZ: -338, maxZ: -270, center: [71, -304] },
  { name: 'Orchard Grove', side: 'west', minZ: -406, maxZ: -338, center: [-72, -372] },
  { name: 'Brickworks', side: 'east', minZ: -406, maxZ: -338, center: [71, -372] },
  { name: 'Cedar Park', side: 'west', minZ: -474, maxZ: -406, center: [-72, -440] },
  { name: 'Skyline Court', side: 'east', minZ: -474, maxZ: -406, center: [71, -440] },
  { name: 'Ganton', side: 'west', minZ: -576, maxZ: -474, center: [-78, -525] },
  { name: 'Market Mile', side: 'east', minZ: -576, maxZ: -474, center: [71, -525] },
]);

export function districtAt({ x, z }) {
  if (z < -270) {
    const side = x < 18 ? 'west' : 'east';
    return NEW_DISTRICTS.find(district => district.side === side && z >= district.minZ && z < district.maxZ)?.name ?? null;
  }
  if (z > 74) return 'Harbor Walk';
  if (z < -195) return x < -51 ? 'Sunny Farm' : x > 52 ? 'Mail District' : 'North Town';
  if (z < -100) return x > 52 ? 'Workshop District' : x < -51 ? 'Parks District' : 'School District';
  return x < -51 ? 'Suburbs' : x > 52 ? 'Industrial Yards' : z < 5 ? 'Downtown' : x > 18 ? 'Fire Station' : 'Town Square';
}
