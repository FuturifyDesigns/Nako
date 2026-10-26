import { catalog } from "../data/catalog.js";
import { distanceToPath, rankRoutes } from "../src/js/geo.js";

const ids = new Set();
let routes = 0;
const errors = [];

function claim(id, label) {
  if (!id || ids.has(id)) errors.push(`duplicate or empty id ${id} (${label})`);
  ids.add(id);
}

for (const place of catalog.places) {
  claim(place.id, place.name);
  if (place.lat < -27 || place.lat > -17 || place.lng < 19 || place.lng > 30) errors.push(`place outside Botswana ${place.name}`);
  for (const zone of place.zones || []) claim(zone.id, zone.name);
  for (const route of place.routes || []) {
    routes += 1;
    claim(route.id, route.name);
    if (route.zone_id && !(place.zones || []).some((zone) => zone.id === route.zone_id)) errors.push(`missing zone ${route.zone_id} on ${route.name}`);
    if (!route.path || route.path.length < 2) errors.push(`short path ${route.name}`);
    for (const point of route.path) {
      if (point.lat < -27.5 || point.lat > -17 || point.lng < 19 || point.lng > 30) errors.push(`path outside Botswana ${route.name}`);
    }
  }
}

for (const alias of catalog.aliases) {
  if (!catalog.places.some((place) => place.id === alias.placeId)) errors.push(`alias place ${alias.placeId}`);
}

const gaborone = catalog.places.find((place) => place.id === "gaborone");
const kombis = gaborone.routes.filter((route) => route.transport_type === "kombi");
const ranked = rankRoutes(kombis, { lat: -24.623, lng: 25.952 });
if (!ranked[0].route.name.toLowerCase().includes("broadhurst")) errors.push(`expected a Broadhurst route near Broadhurst, got ${ranked[0].route.name}`);
if (distanceToPath({ lat: -24.6548, lng: 25.9078 }, gaborone.routes[0].path) > 50) errors.push("station should sit on Broadhurst route 1");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`catalog ok: ${catalog.places.length} places, ${routes} routes, nearest ${ranked[0].route.name}`);
