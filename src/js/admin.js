import { el, clear } from "./dom.js";
import { suggestPlaces } from "./geo.js";
import { adminSummary, currentCatalog, onSync, refreshCatalog, savePlace, saveRoute, saveZone, setRouteActive, slugify, startSync, supabaseClient } from "./sync.js";

const EMPTY_SUMMARY = {
  sessions_total: 0,
  sessions_today: 0,
  sessions_7d: 0,
  searches_today: 0,
  searches_7d: 0,
  opens_today: 0,
  install_clicks_7d: 0,
  pwa_sessions: 0,
  by_day: [],
  top_cities: [],
  top_routes: [],
  transport_mix: { taxi: 0, kombi: 0, bus: 0 },
  recent: []
};

export async function mountAdmin(root) {
  const client = supabaseClient();
  await startSync();
  if (!client) {
    root.append(el("section", { class: "card admin-card" }, [
      el("h1", { text: "Association dashboard" }),
      el("p", { text: "Supabase is not configured on this build, so sign-in cannot start." })
    ]));
    return;
  }
  const { data } = await client.auth.getSession();
  if (!isAdmin(data.session)) {
    renderLogin(root, client);
    return;
  }
  renderDashboard(root, client);
}

function isAdmin(session) {
  return session?.user?.app_metadata?.role === "admin";
}

function renderLogin(root, client) {
  const message = el("p", { class: "form-error", hidden: true });
  const email = el("input", { type: "email", required: "true", autocomplete: "username", placeholder: "admin@nako.bw", "aria-label": "Email" });
  const password = el("input", { type: "password", required: "true", autocomplete: "current-password", "aria-label": "Password" });
  const form = el("form", { class: "stack" }, [
    el("label", { text: "Work email" }),
    email,
    el("label", { text: "Password" }),
    password,
    message,
    el("button", { class: "find", type: "submit", text: "Enter dashboard" })
  ]);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hidden = true;
    const { data, error } = await client.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
    if (error || !isAdmin(data.session)) {
      if (data.session && !isAdmin(data.session)) await client.auth.signOut();
      message.hidden = false;
      message.textContent = "Those details were not accepted.";
      return;
    }
    clear(root);
    renderDashboard(root, client);
  });
  root.append(el("section", { class: "card admin-card" }, [
    brand(),
    el("h1", { text: "Association dashboard" }),
    el("p", { class: "lede", text: "Staff only. Passengers do not create accounts in this phase. This desk shows anonymous usage and the routes published to the finder." }),
    form
  ]));
}

function brand() {
  const mark = el("img", { class: "brand-mark", src: "../assets/icons/nako-mark.svg", alt: "", width: "40", height: "40" });
  return el("div", { class: "brand" }, [
    mark,
    el("span", { class: "brand-name", text: "Nako" }),
    el("span", { class: "brand-sub", text: "taxi rank network" })
  ]);
}

function renderDashboard(root, client) {
  const stats = el("div", { class: "stat-grid" });
  const chart = el("div", { class: "chart" });
  const cities = el("div", { class: "panel" });
  const recent = el("div", { class: "panel" });
  const mix = el("div", { class: "panel" });
  const routesPanel = el("div", { class: "panel wide" });
  const notice = el("p", { class: "hint", text: "Loading usage…" });
  root.append(el("div", { class: "admin-shell" }, [
    el("aside", { class: "admin-side" }, [
      brand(),
      el("p", { text: "Usage and routes" }),
      el("button", { type: "button", class: "ghost", onclick: async () => { await client.auth.signOut(); location.reload(); } }, ["Sign out"])
    ]),
    el("main", { class: "admin-main" }, [
      el("header", { class: "admin-head" }, [
        el("div", {}, [
          el("h1", { text: "Overview" }),
          el("p", { text: "Anonymous sessions only. Location coordinates are not stored." })
        ]),
        notice
      ]),
      stats,
      el("div", { class: "admin-split" }, [el("section", { class: "panel" }, [el("h2", { text: "Last 14 days" }), chart]), mix]),
      el("div", { class: "admin-split" }, [cities, recent]),
      routesPanel
    ])
  ]));

  async function load() {
    try {
      const summary = await adminSummary() || EMPTY_SUMMARY;
      paintSummary(summary, stats, chart, cities, recent, mix);
      notice.textContent = "Live";
    } catch (error) {
      notice.textContent = navigator.onLine ? "Usage figures will appear after the first synced visits." : "Offline. Route edits will sync later.";
      if (!stats.childElementCount) paintSummary(EMPTY_SUMMARY, stats, chart, cities, recent, mix);
      console.warn(error);
    }
    paintRoutes(routesPanel, client);
  }

  load();
  onSync(() => paintRoutes(routesPanel, client));
  window.setInterval(() => { if (!document.hidden) load(); }, 30000);
}

function stat(label, value) {
  return el("article", { class: "stat" }, [el("span", { text: label }), el("strong", { text: String(value ?? 0) })]);
}

function paintSummary(summary, stats, chart, cities, recent, mix) {
  clear(stats);
  stats.append(
    stat("People", summary.sessions_total),
    stat("People today", summary.sessions_today),
    stat("Searches today", summary.searches_today),
    stat("Searches, 7 days", summary.searches_7d),
    stat("App opens today", summary.opens_today),
    stat("Install clicks, 7 days", summary.install_clicks_7d),
    stat("Installed-app sessions", summary.pwa_sessions)
  );
  clear(chart);
  const days = summary.by_day || [];
  const max = Math.max(1, ...days.map((day) => Number(day.searches) || 0));
  if (!days.length) chart.append(el("p", { class: "hint", text: "No searches in the last 14 days yet." }));
  for (const day of days) {
    const searches = Number(day.searches) || 0;
    chart.append(el("div", { class: "bar" }, [
      el("span", { style: `height:${Math.max(6, (searches / max) * 120)}px` }),
      el("small", { text: String(day.day).slice(5) }),
      el("em", { text: String(searches) })
    ]));
  }
  clear(cities);
  cities.append(el("h2", { text: "Towns people search" }));
  const topCities = summary.top_cities || [];
  if (!topCities.length) cities.append(el("p", { class: "hint", text: "No town searches yet." }));
  for (const city of topCities) cities.append(el("p", { class: "row" }, [el("strong", { text: city.city || "Unknown" }), el("span", { text: String(city.hits) })]));

  clear(recent);
  recent.append(el("h2", { text: "Recent activity" }));
  const events = summary.recent || [];
  if (!events.length) recent.append(el("p", { class: "hint", text: "Activity appears here as people use the app." }));
  for (const event of events) {
    recent.append(el("p", { class: "row" }, [
      el("strong", { text: String(event.event_name || "").replaceAll("_", " ") }),
      el("span", { text: [event.city, event.transport_type].filter(Boolean).join(" · ") || timeAgo(event.created_at) })
    ]));
  }

  clear(mix);
  mix.append(el("h2", { text: "Transport mix" }));
  const transport = summary.transport_mix || {};
  for (const key of ["kombi", "taxi", "bus"]) {
    mix.append(el("p", { class: "row" }, [el("strong", { text: key }), el("span", { text: String(transport[key] || 0) })]));
  }
}

function timeAgo(value) {
  if (!value) return "";
  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

async function loadAllRoutes(client) {
  if (!navigator.onLine) {
    return currentCatalog().places.flatMap((place) => place.routes.map((route) => ({ ...route, place_name: place.name, active: true })));
  }
  const { data, error } = await client.from("routes").select("id,place_id,zone_id,name,transport_type,origin_name,destination_name,summary,path,guide,active,places(name)").order("name");
  if (error) throw error;
  return (data || []).map((route) => ({ ...route, place_name: route.places?.name || route.place_id }));
}

function paintRoutes(panel, client) {
  clear(panel);
  const list = el("div", { class: "route-table" });
  const editor = el("div", { class: "editor" });
  panel.append(
    el("div", { class: "step-row" }, [
      el("h2", { text: "Routes" }),
      el("button", { type: "button", class: "ghost", onclick: () => openEditor(editor, client, null, () => paintRoutes(panel, client)) }, ["Add route"])
    ]),
    el("p", { class: "hint", text: "Add a route for any town in Botswana. It appears in the passenger route selector after sync. Paths marked approximate can be redrawn." }),
    editor,
    list
  );
  loadAllRoutes(client).then((routes) => {
    if (!routes.length) {
      list.append(el("p", { class: "hint", text: "No routes yet." }));
      return;
    }
    for (const route of routes) {
      list.append(el("article", { class: "route-row" }, [
        el("div", {}, [
          el("strong", { text: route.name }),
          el("span", { text: `${route.place_name || ""} · ${route.transport_type}${route.active === false ? " · hidden" : ""}${route.guide ? " · approximate path" : ""}` })
        ]),
        el("div", { class: "row-actions" }, [
          el("button", { type: "button", class: "text-button", onclick: () => openEditor(editor, client, route, () => paintRoutes(panel, client)) }, ["Edit"]),
          el("button", { type: "button", class: "text-button muted", onclick: async () => { await setRouteActive(route.id, route.active === false); paintRoutes(panel, client); } }, [route.active === false ? "Publish" : "Hide"])
        ])
      ]));
    }
  }).catch(() => {
    list.append(el("p", { class: "hint", text: "Routes could not be loaded. They remain saved for passengers who already synced." }));
  });
}

function openEditor(host, client, route, onDone) {
  clear(host);
  const catalog = currentCatalog();
  const placeSelect = el("select", { "aria-label": "Town" });
  placeSelect.append(el("option", { value: "", text: "Choose a town" }));
  for (const place of catalog.places) placeSelect.append(el("option", { value: place.id, text: place.name }));
  placeSelect.append(el("option", { value: "__new", text: "Add a town or village" }));
  const newPlace = el("div", { class: "stack", hidden: true });
  const placeName = el("input", { placeholder: "Town name", "aria-label": "New town name" });
  const placeKind = el("select", { "aria-label": "Kind" }, ["city", "town", "village"].map((kind) => el("option", { value: kind, text: kind })));
  const placeLat = el("input", { placeholder: "Latitude", "aria-label": "Latitude" });
  const placeLng = el("input", { placeholder: "Longitude", "aria-label": "Longitude" });
  newPlace.append(placeName, placeKind, placeLat, placeLng, el("button", { type: "button", class: "ghost", onclick: async () => {
    const matches = suggestPlaces(placeName.value, catalog);
    if (matches[0]?.type === "place") {
      placeLat.value = matches[0].place.lat;
      placeLng.value = matches[0].place.lng;
      return;
    }
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", `${placeName.value}, Botswana`);
      url.searchParams.set("countrycodes", "bw");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "1");
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      const rows = await response.json();
      if (rows[0]) {
        placeLat.value = rows[0].lat;
        placeLng.value = rows[0].lon;
      }
    } catch {
      placeLat.placeholder = "Type latitude manually";
    }
  } }, ["Find coordinates"]));

  const zoneSelect = el("select", { "aria-label": "Zone" });
  const newZone = el("input", { placeholder: "Or type a new locality", "aria-label": "New locality" });
  const name = el("input", { value: route?.name || "", placeholder: "Route name", "aria-label": "Route name" });
  const type = el("select", { "aria-label": "Transport" }, ["kombi", "taxi", "bus"].map((item) => el("option", { value: item, text: item, selected: route?.transport_type === item ? "selected" : null })));
  const origin = el("input", { value: route?.origin_name || "", placeholder: "Origin", "aria-label": "Origin" });
  const destination = el("input", { value: route?.destination_name || "", placeholder: "Destination", "aria-label": "Destination" });
  const summary = el("textarea", { placeholder: "Short description passengers will read", "aria-label": "Summary" });
  summary.value = route?.summary || "";
  const path = Array.isArray(route?.path) ? route.path.map((point) => ({ ...point })) : [];
  const pathLabel = el("p", { class: "hint", text: pathText(path) });
  const mapBox = el("div", { class: "editor-map" });
  const message = el("p", { class: "form-error", hidden: true });

  function fillZones() {
    clear(zoneSelect);
    zoneSelect.append(el("option", { value: "", text: "No locality filter" }));
    const place = catalog.places.find((item) => item.id === placeSelect.value);
    for (const zone of place?.zones || []) zoneSelect.append(el("option", { value: zone.id, text: zone.name }));
    if (route?.zone_id) zoneSelect.value = route.zone_id;
  }

  placeSelect.value = route?.place_id || catalog.places.find((place) => place.name === "Gaborone")?.id || "";
  placeSelect.addEventListener("change", () => {
    newPlace.hidden = placeSelect.value !== "__new";
    fillZones();
  });
  fillZones();

  let map;
  host.append(el("form", { class: "stack editor-form" }, [
    el("h3", { text: route ? "Edit route" : "New route" }),
    placeSelect,
    newPlace,
    zoneSelect,
    newZone,
    name,
    type,
    origin,
    destination,
    summary,
    mapBox,
    el("div", { class: "location-actions" }, [
      el("button", { type: "button", class: "ghost", onclick: () => { path.pop(); pathLabel.textContent = pathText(path); draw(); } }, ["Undo point"]),
      el("button", { type: "button", class: "ghost", onclick: () => { path.length = 0; pathLabel.textContent = pathText(path); draw(); } }, ["Clear path"])
    ]),
    pathLabel,
    message,
    el("div", { class: "location-actions" }, [
      el("button", { class: "find", type: "submit", text: "Save route" }),
      el("button", { type: "button", class: "ghost", onclick: () => { map?.remove(); clear(host); } }, ["Cancel"])
    ])
  ]));
  host.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hidden = true;
    try {
      const saved = await persist({ client, route, placeSelect, placeName, placeKind, placeLat, placeLng, zoneSelect, newZone, name, type, origin, destination, summary, path });
      if (saved.queued) message.textContent = "Saved on this phone. It will publish when you are back online.";
      else message.textContent = "";
      map?.remove();
      await refreshCatalog();
      onDone();
    } catch (error) {
      message.hidden = false;
      message.textContent = error.message || "The route could not be saved.";
    }
  });

  if (globalThis.maplibregl) {
    const center = path[0] || { lng: 25.9231, lat: -24.6282 };
    map = new maplibregl.Map({
      container: mapBox,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [center.lng, center.lat],
      zoom: 12
    });
    map.on("load", () => {
      map.addSource("draft", { type: "geojson", data: emptyFeature() });
      map.addLayer({ id: "draft-line", type: "line", source: "draft", paint: { "line-color": "#1f6feb", "line-width": 4 } });
      draw();
    });
    map.on("click", (event) => {
      path.push({ lat: event.lngLat.lat, lng: event.lngLat.lng });
      pathLabel.textContent = pathText(path);
      draw();
    });
  }

  function draw() {
    const source = map?.getSource("draft");
    if (!source) return;
    source.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: path.map((point) => [point.lng, point.lat]) }
    });
  }
}

function emptyFeature() {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } };
}

function pathText(path) {
  if (path.length < 2) return "Click the map to draw the corridor. At least two points are required.";
  return `${path.length} points on this corridor.`;
}

async function persist(fields) {
  let placeId = fields.placeSelect.value;
  if (!fields.name.value.trim() || !fields.origin.value.trim() || !fields.destination.value.trim()) {
    throw new Error("Name, origin, and destination are required.");
  }
  if (fields.path.length < 2) throw new Error("Draw at least two points on the map.");
  if (placeId === "__new") {
    if (!fields.placeName.value.trim() || !fields.placeLat.value || !fields.placeLng.value) throw new Error("New towns need a name and coordinates.");
    placeId = slugify(fields.placeName.value);
    const placeResult = await savePlace({
      id: placeId,
      name: fields.placeName.value.trim(),
      kind: fields.placeKind.value,
      lat: Number(fields.placeLat.value),
      lng: Number(fields.placeLng.value),
      popular: false,
      active: true
    });
    if (placeResult.error && !placeResult.queued) throw new Error("The town could not be saved.");
  }
  if (!placeId) throw new Error("Choose a town.");
  let zoneId = fields.zoneSelect.value || null;
  if (fields.newZone.value.trim()) {
    zoneId = `${placeId}-${slugify(fields.newZone.value)}`;
    await saveZone({
      id: zoneId,
      place_id: placeId,
      name: fields.newZone.value.trim(),
      summary: fields.newZone.value.trim(),
      lat: fields.path[0].lat,
      lng: fields.path[0].lng,
      sort: 10,
      active: true
    });
  }
  return saveRoute({
    id: fields.route?.id || `${placeId}-${fields.type.value}-${slugify(fields.name.value)}-${crypto.randomUUID().slice(0, 4)}`,
    place_id: placeId,
    zone_id: zoneId,
    name: fields.name.value.trim(),
    transport_type: fields.type.value,
    origin_name: fields.origin.value.trim(),
    destination_name: fields.destination.value.trim(),
    summary: fields.summary.value.trim(),
    path: fields.path,
    guide: true,
    active: fields.route?.active !== false
  });
}
