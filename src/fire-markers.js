export function edgeMarkerLayout(directionX, directionY, distance, width, height) {
  const sideInset = Math.min(90, Math.max(50, width * .08));
  const topInset = Math.min(90, Math.max(55, height * .09));
  const bottomInset = width < 700 ? Math.min(230, height * .28)
    : height < 540 ? Math.min(170, height * .32) : topInset;
  const x = directionX || 0, y = directionY || -.001;
  const xLimit = width / 2 - sideInset;
  const yLimit = y >= 0 ? height / 2 - bottomInset : height / 2 - topInset;
  const factor = Math.min(Math.max(1,xLimit) / Math.max(Math.abs(x), 1e-6), Math.max(1,yLimit) / Math.max(Math.abs(y), 1e-6));
  return {
    x: width / 2 + x * factor,
    y: height / 2 + y * factor,
    angle: Math.atan2(y, x) * 180 / Math.PI + 90,
    scale: .55 + .9 * (1 - Math.min(distance, 160) / 160),
  };
}
