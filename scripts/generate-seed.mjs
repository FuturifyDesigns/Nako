import { writeFileSync } from "node:fs";
import { catalog } from "../data/catalog.js";

function sql(value) {
  if (value == null) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

const places = [];
const zones = [];
const routes = [];

for (const place of catalog.places) {
  places.push(`(${sql(place.id)}, ${sql(place.name)}, ${sql(place.kind)}, ${place.lat}, ${place.lng}, ${place.popular ? "true" : "false"}, true)`);
  for (const zone of place.zones || []) {
    zones.push(`(${sql(zone.id)}, ${sql(place.id)}, ${sql(zone.name)}, ${sql(zone.summary || "")}, ${zone.lat}, ${zone.lng}, ${zone.sort || 0}, true)`);
  }
  for (const route of place.routes || []) {
    routes.push(`(${[
      sql(route.id),
      sql(place.id),
      route.zone_id ? sql(route.zone_id) : "null",
      sql(route.name),
      sql(route.transport_type),
      sql(route.origin_name),
      sql(route.destination_name),
      sql(route.summary || ""),
      `${sql(JSON.stringify(route.path))}::jsonb`,
      route.guide === false ? "false" : "true",
      "true"
    ].join(", ")})`);
  }
}

const seed = `-- Generated from data/catalog.js. Safe to re-run; existing rows are left as edited.
insert into public.places (id, name, kind, lat, lng, popular, active) values
${places.join(",\n")}
on conflict (id) do nothing;

insert into public.zones (id, place_id, name, summary, lat, lng, sort, active) values
${zones.join(",\n")}
on conflict (id) do nothing;

insert into public.routes (
  id, place_id, zone_id, name, transport_type, origin_name, destination_name, summary, path, guide, active
) values
${routes.join(",\n")}
on conflict (id) do nothing;
`;

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), seed);
console.log(`places ${places.length}, zones ${zones.length}, routes ${routes.length}`);
