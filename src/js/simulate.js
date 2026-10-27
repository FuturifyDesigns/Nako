import { haversine, offsetPoint, pointAlong } from "./geo.js";

const LETTERS = "ABCDFGHJKLMNPQRSTVWXYZ";

function hash(text) {
  let value = 2166136261;
  for (const char of text) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function plate(seed) {
  const n = hash(seed);
  const num = 100 + (n % 900);
  const a = LETTERS[n % LETTERS.length];
  const b = LETTERS[(n >> 5) % LETTERS.length];
  const c = LETTERS[(n >> 10) % LETTERS.length];
  return `B ${num} ${a}${b}${c}`;
}

function statusFor(distance) {
  if (distance == null) return "at_rank";
  if (distance < 450) return "nearby";
  if (distance < 2800) return "on_way";
  return "at_rank";
}

function pushVehicle(list, route, fraction, side, type, point) {
  const spot = pointAlong(route.path, fraction) || route.path[0];
  const shifted = offsetPoint(spot, spot.bearing + 90, side);
  const id = `${route.id}-${type}-${list.length}`;
  const distance = point ? haversine(point, shifted) : null;
  list.push({
    id,
    plate: plate(id),
    type,
    routeId: route.id,
    routeName: route.name,
    lat: shifted.lat,
    lng: shifted.lng,
    bearing: spot.bearing,
    baseFraction: fraction,
    side,
    distance,
    state: statusFor(distance)
  });
}

export function simulateFleet({ routes, point, distanceTo, type }) {
  const fleet = [];
  const primary = routes[0];
  const secondary = routes[1];
  const transport = type === "taxi" || type === "bus" ? type : "kombi";
  if (!primary) return fleet;

  if (transport === "bus" || (distanceTo ?? 0) > 8000) {
    pushVehicle(fleet, primary, 0.04, 14, transport, point);
    pushVehicle(fleet, primary, 0.08, -16, transport, point);
    if (secondary) pushVehicle(fleet, secondary, 0.05, 12, transport, point);
    if (transport !== "bus") {
      pushVehicle(fleet, primary, 0.18, 18, transport, point);
      pushVehicle(fleet, primary, 0.28, -14, transport, point);
    }
    return fleet;
  }

  const nearest = nearestFraction(primary, point);
  const count = transport === "taxi" ? 4 : 5;
  for (let i = 0; i < count; i += 1) {
    const fraction = Math.min(0.92, Math.max(0.05, nearest + (i - 1) * 0.07));
    pushVehicle(fleet, primary, fraction, i % 2 === 0 ? 16 : -16, transport, point);
  }
  if (secondary) {
    pushVehicle(fleet, secondary, 0.2, 14, transport, point);
    pushVehicle(fleet, secondary, 0.45, -18, transport, point);
  }
  return fleet;
}

function nearestFraction(route, point) {
  if (!point || !route.path?.length) return 0.35;
  let bestT = 0.35;
  let best = Infinity;
  for (let i = 0; i <= 24; i += 1) {
    const t = i / 24;
    const spot = pointAlong(route.path, t);
    if (!spot) continue;
    const dx = spot.lat - point.lat;
    const dy = (spot.lng - point.lng) * Math.cos((point.lat * Math.PI) / 180);
    const distance = dx * dx + dy * dy;
    if (distance < best) {
      best = distance;
      bestT = t;
    }
  }
  return bestT;
}
