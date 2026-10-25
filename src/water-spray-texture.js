// Saved from the original brake effect for the future hose/water-spray sound.
// Two filtered layers of generated noise produce its airy rushing texture.
export const WATER_SPRAY_TEXTURE = Object.freeze([
  Object.freeze({filter: 'bandpass', frequency: 2100, q: .55, gain: 1}),
  Object.freeze({filter: 'bandpass', frequency: 520, q: .5, gain: .36}),
]);
