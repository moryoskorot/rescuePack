// Type IDs refer to source models, never to their placement in the city.
const names = {
  small: Array.from('abcdefghijklmnopqrstu', letter => `building-type-${letter}`),
  large: [...Array.from('abcdefghijklmn', letter => `building-${letter}`),
    ...Array.from('abcde', letter => `building-skyscraper-${letter}`),
    ...Array.from('abcdefghijklmn', letter => `low-detail-building-${letter}`),
    ...Array.from('ab', letter => `low-detail-building-wide-${letter}`)],
  industrial: Array.from('abcdefghijklmnopqrst', letter => `building-${letter}`),
};
const packs = { small: 'suburban', large: 'commercial', industrial: 'industrial' };

export const BUILDING_TYPES = Object.entries(names).flatMap(([group, models], groupIndex) =>
  models.map((name, index) => ({
    id: `B${String(groupIndex + 1)}-${String(index + 1).padStart(2, '0')}`,
    index: index + 1,
    group,
    pack: packs[group],
    name,
    path: `${packs[group]}/${name}`,
  })));

export const BUILDING_TYPES_BY_ID = new Map(BUILDING_TYPES.map(type => [type.id, type]));
export const BUILDING_TYPES_BY_PATH = new Map(BUILDING_TYPES.map(type => [type.path, type]));
