export const FIRE_XP = 25;

const ranks = [
  { name: 'Rookie', insignia: '01-rookie.png' },
  { name: 'Ember Scout', insignia: '02-ember-scout.png' },
  { name: 'Hose Hero', insignia: '03-hose-hero.png' },
  { name: 'Firefighter', insignia: '04-firefighter.png' },
  { name: 'Blaze Runner', insignia: '05-blaze-runner.png' },
  { name: 'Fire Guard', insignia: '06-fire-guard.png' },
  { name: 'Station Captain', insignia: '07-station-captain.png' },
  { name: 'Battalion Chief', insignia: '08-battalion-chief.png' },
  { name: 'Deputy Chief', insignia: '09-deputy-chief.png' },
  { name: 'Supreme Chief', insignia: '10-supreme-chief.png' },
];

// Each entry is the number of additional fires for the next promotion.
const firesPerPromotion = [2, 4, 6, 10, 11, 12, 13, 14, 15];
const rankThresholds = firesPerPromotion.reduce((thresholds, fires) => {
  thresholds.push(thresholds.at(-1) + fires * FIRE_XP);
  return thresholds;
}, [0]);

export function firefighterRank(xp) {
  const index = rankThresholds.findLastIndex(threshold => xp >= threshold);
  return {
    ...ranks[index],
    number: index + 1,
    startXp: rankThresholds[index],
    nextXp: rankThresholds[index + 1] ?? null,
  };
}
