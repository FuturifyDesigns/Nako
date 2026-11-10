import { config } from "./config.js";
import { haversine } from "./geo.js";
import { idbGet, idbSet } from "./idb.js";
import { supabaseClient } from "./sync.js";

const CACHE_KEY = "live-vehicles";
const FRESH_MS = 5 * 60 * 1000;
const MOTION_FRESH_MS = 15000;

function normalize(row, point) {
  const sampled = new Date(row.sampled_at || row.updated_at || 0).getTime();
  const vehicle = {
    id: row.driver_id,
    plate: row.plate,
    type: row.transport_type,
    routeIds: row.route_ids || [],
    routeId: row.route_ids?.[0] || null,
    routeName: "Registered route",
    lat: Number(row.lat),
    lng: Number(row.lng),
    accuracy: Number(row.accuracy || 0),
    bearing: Number(row.heading || 0),
    sampledAt: row.sampled_at,
    state: row.motion_state === "moving" && Date.now() - sampled < MOTION_FRESH_MS ? "moving" : "idle"
  };
  vehicle.distance = point ? haversine(point, vehicle) : null;
  return vehicle;
}

export async function loadLiveVehicles({ transport, routeId, point } = {}) {
  const db = supabaseClient();
  let rows = [];
  if (db && navigator.onLine) {
    const cutoff = new Date(Date.now() - FRESH_MS).toISOString();
    let query = db.from("driver_locations")
      .select("driver_id,transport_type,plate,route_ids,lat,lng,accuracy,speed,heading,motion_state,sampled_at,updated_at")
      .eq("sharing", true)
      .gte("updated_at", cutoff)
      .order("updated_at", { ascending: false })
      .limit(120);
    if (transport) query = query.eq("transport_type", transport);
    if (routeId && routeId !== "all") query = query.contains("route_ids", [routeId]);
    const { data, error } = await query;
    if (!error) {
      rows = data || [];
      await idbSet(CACHE_KEY, rows);
    }
  }
  if (!rows.length) rows = (await idbGet(CACHE_KEY)) || [];
  return rows
    .filter((row) => !transport || row.transport_type === transport)
    .filter((row) => !routeId || routeId === "all" || (row.route_ids || []).includes(routeId))
    .filter((row) => Date.now() - new Date(row.updated_at || 0).getTime() < (navigator.onLine ? FRESH_MS : 24 * 60 * 60 * 1000))
    .map((row) => normalize(row, point));
}

export function watchLiveVehicles(options, onChange) {
  let stopped = false;
  let channel = null;
  let debounceTimer = 0;
  const refresh = async () => {
    if (stopped || document.hidden) return;
    try { onChange(await loadLiveVehicles(options())); } catch (error) { console.warn("Live vehicles unavailable", error); }
  };
  const scheduleRefresh = () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(refresh, 100);
  };
  refresh();
  const timer = window.setInterval(refresh, config.passengerRefreshIntervalMs || 20000);
  const db = supabaseClient();
  if (db) {
    const initial = options();
    channel = db.channel(`nako-live-${crypto.randomUUID()}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "driver_locations",
        ...(initial.transport ? { filter: `transport_type=eq.${initial.transport}` } : {})
      }, scheduleRefresh)
      .subscribe();
  }
  const onVisible = () => { if (!document.hidden) refresh(); };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    stopped = true;
    window.clearInterval(timer);
    window.clearTimeout(debounceTimer);
    document.removeEventListener("visibilitychange", onVisible);
    if (channel && db) db.removeChannel(channel);
  };
}
