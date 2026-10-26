const EARTH = 6371000;

function rad(value) {
  return (value * Math.PI) / 180;
}

export function haversine(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const lat1 = rad(a.lat);
  const lat2 = rad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearing(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return "";
  if (meters < 950) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function pathLength(path) {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) total += haversine(path[i - 1], path[i]);
  return total;
}

export function pointAlong(path, fraction) {
  if (!path?.length) return null;
  if (path.length === 1) return { ...path[0], bearing: 0 };
  const target = pathLength(path) * Math.min(1, Math.max(0, fraction));
  let walked = 0;
  for (let i = 1; i < path.length; i += 1) {
    const seg = haversine(path[i - 1], path[i]);
    if (walked + seg >= target || i === path.length - 1) {
      const t = seg === 0 ? 0 : Math.min(1, (target - walked) / seg);
      return {
        lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * t,
        lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * t,
        bearing: bearing(path[i - 1], path[i])
      };
    }
    walked += seg;
  }
  return { ...path[path.length - 1], bearing: 0 };
}

function projectSegment(point, a, b) {
  const lat0 = rad(point.lat);
  const x = (lng) => rad(lng) * EARTH * Math.cos(lat0);
  const y = (lat) => rad(lat) * EARTH;
  const px = x(point.lng);
  const py = y(point.lat);
  const ax = x(a.lng);
  const ay = y(a.lat);
  const bx = x(b.lng);
  const by = y(b.lat);
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2));
  const qx = ax + dx * t;
  const qy = ay + dy * t;
  return Math.hypot(px - qx, py - qy);
}

export function distanceToPath(point, path) {
  if (!point || !path?.length) return Infinity;
  if (path.length === 1) return haversine(point, path[0]);
  let best = Infinity;
  for (let i = 1; i < path.length; i += 1) best = Math.min(best, projectSegment(point, path[i - 1], path[i]));
  return best;
}

export function offsetPoint(point, bearingDeg, meters) {
  const br = rad(bearingDeg);
  return {
    lat: point.lat + (meters * Math.cos(br)) / 111320,
    lng: point.lng + (meters * Math.sin(br)) / (111320 * Math.cos(rad(point.lat)))
  };
}

export function rankRoutes(routes, point) {
  return routes
    .map((route) => ({ route, distance: distanceToPath(point, route.path) }))
    .sort((a, b) => a.distance - b.distance);
}

export function nearestLandmark(landmarks, point) {
  if (!point || !landmarks?.length) return null;
  let best = null;
  for (const landmark of landmarks) {
    const distance = haversine(point, landmark);
    if (!best || distance < best.distance) best = { landmark, distance };
  }
  return best && best.distance < 700 ? best : null;
}

export function suggestPlaces(query, catalog) {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];
  const results = [];
  for (const place of catalog.places) {
    if (place.name.toLowerCase().includes(q)) {
      results.push({ type: "place", place, label: place.name, detail: place.kind });
    }
  }
  for (const alias of catalog.aliases || []) {
    if (alias.label.toLowerCase().includes(q) || alias.q.includes(q)) {
      const place = catalog.places.find((item) => item.id === alias.placeId);
      if (!place) continue;
      results.push({ type: "alias", place, alias, label: alias.label, detail: `In ${place.name}` });
    }
  }
  const seen = new Set();
  return results.filter((item) => {
    const key = `${item.label}|${item.place.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

export function boundsOf(points) {
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)]
  ];
}
