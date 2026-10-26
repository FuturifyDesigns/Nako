import { offsetPoint, pointAlong } from "./geo.js";

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

function pushVehicle(list, route, fraction, side, type) {
  const spot = pointAlong(route.path, fraction) || route.path[0];
  const shifted = offsetPoint(spot, spot.bearing + 90, side);
  const id = `${route.id}-${list.length}`;
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
    state: "idling",
    creep: type === "bus" ? 0 : 0.012
  });
}

export function simulateFleet({ routes, point, distanceTo, type }) {
  const fleet = [];
  const primary = routes[0];
  const secondary = routes[1];
  if (!primary) return fleet;

  if (type === "bus" || (distanceTo ?? 0) > 8000) {
    pushVehicle(fleet, primary, 0.04, 14, type);
    pushVehicle(fleet, primary, 0.08, -16, type);
    if (secondary) pushVehicle(fleet, secondary, 0.05, 12, type);
    if (type !== "bus") {
      pushVehicle(fleet, primary, 0.18, 18, type);
      pushVehicle(fleet, primary, 0.28, -14, type);
    }
    return fleet;
  }

  const nearest = nearestFraction(primary, point);
  const count = type === "taxi" ? 4 : 5;
  for (let i = 0; i < count; i += 1) {
    const fraction = Math.min(0.92, Math.max(0.05, nearest + (i - 1) * 0.07));
    pushVehicle(fleet, primary, fraction, i % 2 === 0 ? 16 : -16, type);
  }
  if (secondary) {
    pushVehicle(fleet, secondary, 0.2, 14, type);
    pushVehicle(fleet, secondary, 0.45, -18, type);
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

export function animateFleet(fleet, routes, timeMs) {
  return fleet.map((vehicle, index) => {
    if (!vehicle.creep) return vehicle;
    const route = routes.find((item) => item.id === vehicle.routeId);
    if (!route?.path?.length) return vehicle;
    const wobble = Math.sin(timeMs / 1800 + index) * vehicle.creep;
    const moved = pointAlong(route.path, Math.min(0.96, Math.max(0.02, vehicle.baseFraction + wobble)));
    if (!moved) return vehicle;
    const shifted = offsetPoint(moved, moved.bearing + 90, vehicle.side);
    return { ...vehicle, lat: shifted.lat, lng: shifted.lng, bearing: moved.bearing };
  });
}
