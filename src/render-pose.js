const lerp = (a, b, alpha) => a + (b - a) * alpha;

export function interpolateVehiclePose(previous, current, alpha) {
  const yaw = Math.atan2(Math.sin(current.heading - previous.heading), Math.cos(current.heading - previous.heading));
  return {
    x: lerp(previous.x, current.x, alpha),
    z: lerp(previous.z, current.z, alpha),
    heading: previous.heading + yaw * alpha,
    wheelSpin: lerp(previous.wheelSpin, current.wheelSpin, alpha),
    steeringAngle: lerp(previous.steeringAngle, current.steeringAngle, alpha),
  };
}
