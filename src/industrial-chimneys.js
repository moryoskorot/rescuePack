// Local coordinates of the openings of the large tubular chimneys built into
// the industrial GLBs. Small roof vents and the separate chimney prop are not
// part of a building's fire state.
export const INDUSTRIAL_CHIMNEYS = {
  'industrial/building-b': [
    { center: [-.727, 1.25, .351], diameter: .18 },
  ],
  'industrial/building-c': [
    { center: [.341, 1.25, -.181], diameter: .15 },
    { center: [.341, 1.25, .169], diameter: .15 },
  ],
  'industrial/building-e': [
    { center: [-.578, 1.65, .674], diameter: .15 },
    { center: [-.178, 1.65, .674], diameter: .15 },
  ],
  'industrial/building-f': [
    { center: [-1.103, 1.925, -.121], diameter: .25 },
  ],
  'industrial/building-l': [
    { center: [-.295, 1.925, .934], diameter: .25 },
  ],
  'industrial/building-m': [
    { center: [.329, 1.519, -.4], diameter: .12 },
    { center: [.329, 1.519, 0], diameter: .12 },
    { center: [.329, 1.519, .4], diameter: .12 },
  ],
  'industrial/building-n': [
    { center: [-.183, 1.905, .82], diameter: .12 },
  ],
};

// Chimneys have their own rule, separate from the windows' height bands.
export function chimneyFireStrength(percent) {
  return percent <= 0 ? -1 : percent <= 80 ? 0 : 2;
}
