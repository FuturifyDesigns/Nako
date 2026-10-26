import { localCatalog } from "../../data/catalog.js";
import { config } from "./config.js";
import { idbGet, idbSet } from "./idb.js";
import { isStandalone, sessionId } from "./session.js";

const EVENTS = new Set([
  "app_open",
  "info_view",
  "install_click",
  "install_accepted",
  "search",
  "transport_select",
  "city_select",
  "route_select",
  "recommendation_accept",
  "recommendation_skip",
  "location_set"
]);

let client = null;
let catalog = localCatalog();
let status = navigator.onLine ? "syncing" : "offline";
const listeners = new Set();
let queue = [];
let flushing = false;

function emit() {
  for (const listener of listeners) listener({ status, catalog });
}

export function onSync(listener) {
  listeners.add(listener);
  listener({ status, catalog });
  return () => listeners.delete(listener);
}

export function currentCatalog() {
  return catalog;
}

export function connectionStatus() {
  return status;
}

function setStatus(next) {
  status = next;
  emit();
}

function getClient() {
  if (client || !config.supabaseUrl || !config.supabaseAnonKey || !globalThis.supabase?.createClient) return client;
  client = globalThis.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    realtime: { params: { eventsPerSecond: 2 } }
  });
  return client;
}

export function supabaseClient() {
  return getClient();
}

function nest(local, rows) {
  const landmarks = new Map(local.places.map((place) => [place.id, place.landmarks || []]));
  return {
    version: local.version,
    aliases: local.aliases,
    places: rows.places.filter((place) => place.active !== false).map((place) => ({
      ...place,
      landmarks: landmarks.get(place.id) || [],
      zones: rows.zones.filter((zone) => zone.place_id === place.id && zone.active !== false).sort((a, b) => (a.sort || 0) - (b.sort || 0)),
      routes: rows.routes.filter((route) => route.place_id === place.id && route.active !== false)
    }))
  };
}

async function pullRemote() {
  const db = getClient();
  if (!db) return null;
  const [places, zones, routes] = await Promise.all([
    db.from("places").select("id,name,kind,lat,lng,popular,active").eq("active", true),
    db.from("zones").select("id,place_id,name,summary,lat,lng,sort,active").eq("active", true),
    db.from("routes").select("id,place_id,zone_id,name,transport_type,origin_name,destination_name,summary,path,guide,active").eq("active", true)
  ]);
  if (places.error || zones.error || routes.error) throw places.error || zones.error || routes.error;
  if (!places.data?.length) return null;
  return { places: places.data, zones: zones.data || [], routes: routes.data || [] };
}

export async function refreshCatalog() {
  const local = localCatalog();
  const cached = await idbGet("catalog");
  if (cached?.places?.length) {
    catalog = cached;
    emit();
  }
  if (!navigator.onLine) {
    setStatus("offline");
    return catalog;
  }
  if (!getClient()) {
    if (!cached?.places?.length) catalog = local;
    setStatus("saved");
    return catalog;
  }
  setStatus("syncing");
  try {
    const remote = await pullRemote();
    if (remote) {
      catalog = nest(local, remote);
      await idbSet("catalog", catalog);
    } else if (!cached) {
      catalog = local;
    }
    setStatus("live");
  } catch {
    setStatus(navigator.onLine ? "saved" : "offline");
  }
  return catalog;
}

function subscribe() {
  const db = getClient();
  if (!db) return;
  db.channel("nako-catalog")
    .on("postgres_changes", { event: "*", schema: "public", table: "routes" }, () => { refreshCatalog(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "places" }, () => { refreshCatalog(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "zones" }, () => { refreshCatalog(); })
    .subscribe();
}

async function flush() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  setStatus("syncing");
  try {
    queue = (await idbGet("queue")) || queue;
    const db = getClient();
    const pending = [];
    for (const item of queue) {
      if (item.kind === "event") {
        if (!db) {
          pending.push(item);
          break;
        }
        const { error } = await db.rpc("record_activity", item.payload);
        if (error) {
          if (error.status >= 400 && error.status < 500) continue;
          pending.push(item);
          break;
        }
      } else if (item.kind === "mutation") {
        if (!db) {
          pending.push(item);
          break;
        }
        const { error } = await applyMutation(db, item);
        if (error) {
          pending.push(item);
          break;
        }
      }
    }
    queue = pending;
    await idbSet("queue", queue);
    if (pending.length === 0) await refreshCatalog();
    setStatus(pending.length ? "saved" : "live");
  } catch {
    setStatus(navigator.onLine ? "saved" : "offline");
  } finally {
    flushing = false;
  }
}

async function applyMutation(db, item) {
  if (item.op === "save-place") return db.from("places").upsert(item.row);
  if (item.op === "save-zone") return db.from("zones").upsert(item.row);
  if (item.op === "save-route") return db.from("routes").upsert(item.row);
  if (item.op === "set-route-active") return db.from("routes").update({ active: item.active }).eq("id", item.id);
  return { error: null };
}

async function enqueue(item) {
  queue = ((await idbGet("queue")) || []).concat(item).slice(-100);
  await idbSet("queue", queue);
  setStatus(navigator.onLine ? "saved" : "offline");
}

export async function track(eventName, fields = {}) {
  if (!EVENTS.has(eventName)) return;
  const payload = {
    p_session_id: sessionId(),
    p_event_name: eventName,
    p_city: fields.city ? String(fields.city).slice(0, 80) : null,
    p_transport_type: fields.transport || null,
    p_route_id: fields.routeId || null,
    p_pwa: isStandalone()
  };
  if (!navigator.onLine || !getClient()) {
    await enqueue({ kind: "event", payload });
    return;
  }
  const { error } = await getClient().rpc("record_activity", payload);
  if (error) await enqueue({ kind: "event", payload });
}

export async function trackOnce(eventName, fields = {}) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `nako_once_${eventName}_${day}`;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, "1");
  await track(eventName, fields);
}

export async function savePlace(row) {
  return mutate({ kind: "mutation", op: "save-place", row });
}

export async function saveZone(row) {
  return mutate({ kind: "mutation", op: "save-zone", row });
}

export async function saveRoute(row) {
  return mutate({ kind: "mutation", op: "save-route", row });
}

export async function setRouteActive(id, active) {
  return mutate({ kind: "mutation", op: "set-route-active", id, active });
}

async function mutate(item) {
  const db = getClient();
  if (!db || !navigator.onLine) {
    await enqueue(item);
    return { queued: true };
  }
  const { error } = await applyMutation(db, item);
  if (error) {
    await enqueue(item);
    return { queued: true, error };
  }
  await refreshCatalog();
  return { queued: false };
}

export async function adminSummary() {
  const db = getClient();
  if (!db) throw new Error("Supabase is not configured.");
  const { data, error } = await db.rpc("admin_summary");
  if (error) throw error;
  return data;
}

export async function startSync() {
  queue = (await idbGet("queue")) || [];
  await refreshCatalog();
  subscribe();
  window.addEventListener("online", () => { flush(); });
  window.addEventListener("offline", () => setStatus("offline"));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) flush();
  });
  flush();
}

export function slugify(value) {
  const base = value.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 48);
  return base || `place-${crypto.randomUUID().slice(0, 8)}`;
}
