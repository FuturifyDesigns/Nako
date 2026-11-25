// Heading is clockwise from north. Keep the last direction at stops so GPS
// noise does not turn a stationary vehicle around.
export function vehicleBearing(vehicle, previous) {
  const last = previous?.bearing ?? 0;
  if (vehicle.state !== "moving") return last;
  if (Number.isFinite(vehicle.bearing)) return (vehicle.bearing + 360) % 360;
  if (!previous) return last;
  const radians = Math.PI / 180;
  const north = (vehicle.lat - previous.lat) * 111320;
  const east = (vehicle.lng - previous.lng) * 111320 * Math.cos(vehicle.lat * radians);
  if (Math.hypot(north, east) < Math.max(12, Number(vehicle.accuracy || 0))) return last;
  return (Math.atan2(east, north) / radians + 360) % 360;
}

// A top-down vehicle with its bonnet pointing north, suitable for rotation.
export const CAR_PATH = "M -6,-10 Q -6,-14 0,-14 Q 6,-14 6,-10 L 7,9 Q 7,13 4,13 L -4,13 Q -7,13 -7,9 Z M -4,-7 L 4,-7 L 3,-2 L -3,-2 Z M -3,5 L 3,5 L 4,9 L -4,9 Z";
export const VEHICLE_COLORS = { taxi: "#f5c542", kombi: "#2584e8", bus: "#12a395" };
