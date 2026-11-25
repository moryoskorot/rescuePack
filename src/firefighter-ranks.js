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

export function firefighterRank(completed, total) {
  // Space promotions evenly from a new save to the final fire call.
  const index = total > 0 ? Math.floor(completed * (ranks.length - 1) / total) : 0;
  return { ...ranks[index], number: index + 1 };
}
