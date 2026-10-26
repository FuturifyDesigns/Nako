import { el, icon, clear } from "./dom.js";
import { formatDistance, haversine, nearestLandmark, rankRoutes, suggestPlaces } from "./geo.js";
import { animateFleet, simulateFleet } from "./simulate.js";
import { createVehicleLayer } from "./vehicle-layer.js";
import { currentCatalog, onSync, startSync, track, trackOnce } from "./sync.js";

const TYPES = [
  { id: "taxi", name: "Taxi", detail: "Local cab", icon: "taxi" },
  { id: "kombi", name: "Kombi", detail: "Minibus", icon: "kombi" },
  { id: "bus", name: "Bus", detail: "Coach", icon: "bus" }
];

const STATUS = {
  live: "Live sync",
  syncing: "Syncing",
  offline: "Offline",
  saved: "Saved on this phone"
};

export async function mountPassenger(root) {
  const state = {
    catalog: currentCatalog(),
    transport: "kombi",
    query: "Gaborone",
    place: null,
    zoneId: "all",
    routeId: "all",
    point: null,
    pointSource: "",
    suggestions: [],
    watchStop: null,
    searching: false,
    fleet: [],
    baseFleet: [],
    selectedVehicle: null,
    followHint: true
  };

  const shell = el("div", { class: "finder" });
  const form = el("section", { class: "card finder-card" });
  const results = el("section", { class: "results", hidden: true });
  shell.append(form, results);
  root.append(shell);

  const statusEl = el("span", { class: "sync-pill", text: "Syncing" });
  const suggestionBox = el("div", { class: "suggestions", hidden: true });
  const zoneBlock = el("div", { class: "zone-block" });
  const routeSelect = el("select", { id: "route-select", "aria-label": "Route" });
  const routeHint = el("p", { class: "hint" });
  const locationLabel = el("p", { class: "location-label", text: "Location is off. We'll use the town centre." });
  const recommendBox = el("div", { class: "recommend", hidden: true });

  form.append(
    el("div", { class: "finder-top" }, [
      el("div", { class: "guest-pill" }, [el("span", { class: "dot" }), "Guest-first passenger access"]),
      statusEl
    ]),
    el("h1", { text: "Know what's coming." }),
    el("p", { class: "lede", text: "Choose a taxi, kombi, or bus, then a town and route. Nearby vehicles are simulated until trackers are fitted." }),
    el("h2", { class: "step", text: "1. Select transport type" }),
    el("div", { class: "type-grid" }, TYPES.map((type) => {
      const button = el("button", {
        type: "button",
        class: `type-card${type.id === state.transport ? " is-selected" : ""}`,
        "aria-pressed": type.id === state.transport ? "true" : "false",
        onclick: () => selectTransport(type.id, button)
      }, [icon(type.icon), el("strong", { text: type.name }), el("span", { text: type.detail })]);
      button.dataset.type = type.id;
      return button;
    })),
    el("div", { class: "step-row" }, [
      el("h2", { class: "step", text: "2. Town, city or village" }),
      el("span", { class: "step-note", text: "Free-text entry" })
    ]),
    el("div", { class: "field" }, [
      icon("pin"),
      el("input", {
        id: "place-input",
        value: state.query,
        placeholder: "Gaborone, Maun, Riverwalk…",
        autocomplete: "off",
        "aria-label": "Town, city or village",
        oninput: (event) => onQuery(event.target.value),
        onfocus: () => showSuggestions(true)
      }),
      el("button", { type: "button", class: "icon-button", "aria-label": "Clear place", onclick: () => onQuery("") }, [icon("close")])
    ]),
    suggestionBox,
    el("div", { class: "chips", id: "popular-chips" }),
    zoneBlock,
    el("div", { class: "step-row" }, [
      el("h2", { class: "step", text: "2C. Your location" }),
      el("span", { class: "step-note", text: "Optional, more accurate" })
    ]),
    el("div", { class: "location-actions" }, [
      el("button", { type: "button", class: "ghost", onclick: toggleGps }, [icon("locate"), "Use my location"]),
      el("button", { type: "button", class: "ghost", onclick: () => openResults({ pinFirst: true }) }, [icon("pin"), "Pin on the map"])
    ]),
    locationLabel,
    el("div", { class: "step-row" }, [
      el("h2", { class: "step", text: "3. Route selector" }),
      el("span", { class: "step-note", id: "route-kind", text: "Kombi corridors" })
    ]),
    routeSelect,
    routeHint,
    recommendBox,
    el("button", { type: "button", class: "find", onclick: () => openResults({ pinFirst: false }) }, [icon("plane"), "Find transport"])
  );

  routeSelect.addEventListener("change", () => {
    state.routeId = routeSelect.value;
    track("route_select", { city: state.place?.name, transport: state.transport, routeId: state.routeId === "all" ? null : state.routeId });
    updateRecommendation();
  });

  document.addEventListener("click", (event) => {
    if (!form.contains(event.target)) suggestionBox.hidden = true;
  });

  function selectTransport(id) {
    state.transport = id;
    state.routeId = "all";
    for (const button of form.querySelectorAll(".type-card")) {
      const on = button.dataset.type === id;
      button.classList.toggle("is-selected", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    }
    const kind = form.querySelector("#route-kind");
    kind.textContent = id === "taxi" ? "Taxi ranks" : id === "bus" ? "Coach corridors" : "Kombi corridors";
    track("transport_select", { transport: id, city: state.place?.name });
    updateRoutes();
  }

  function onQuery(value) {
    state.query = value;
    const input = form.querySelector("#place-input");
    if (input.value !== value) input.value = value;
    state.suggestions = suggestPlaces(value, state.catalog);
    if (!value.trim()) {
      state.place = null;
      state.zoneId = "all";
      suggestionBox.hidden = true;
      updateZones();
      updateRoutes();
      return;
    }
    const exact = state.catalog.places.find((place) => place.name.toLowerCase() === value.trim().toLowerCase());
    if (exact) choosePlace(exact, value.trim());
    renderSuggestions();
  }

  function showSuggestions(force) {
    if (force) state.suggestions = suggestPlaces(state.query, state.catalog);
    renderSuggestions();
  }

  function renderSuggestions() {
    clear(suggestionBox);
    if (!state.suggestions.length || document.activeElement?.id !== "place-input") {
      suggestionBox.hidden = true;
      return;
    }
    suggestionBox.hidden = false;
    for (const item of state.suggestions) {
      suggestionBox.append(el("button", {
        type: "button",
        class: "suggestion",
        onclick: () => applySuggestion(item)
      }, [el("strong", { text: item.label }), el("span", { text: item.detail })]));
    }
  }

  function applySuggestion(item) {
    if (item.type === "alias") {
      choosePlace(item.place, item.label, item.alias.zoneId || "all");
      state.point = { lat: item.alias.lat, lng: item.alias.lng };
      state.pointSource = "typed";
      stopGps();
    } else {
      choosePlace(item.place, item.place.name);
    }
    suggestionBox.hidden = true;
    updateLocation();
  }

  function choosePlace(place, label, zoneId = "all", silent = false) {
    state.place = place;
    state.query = label;
    state.zoneId = zoneId;
    state.routeId = "all";
    const input = form.querySelector("#place-input");
    input.value = label;
    if (!silent) track("city_select", { city: place.name, transport: state.transport });
    updateZones();
    updateRoutes();
  }

  function renderChips() {
    const wrap = form.querySelector("#popular-chips");
    clear(wrap);
    wrap.append(el("span", { class: "chip-label", text: "Popular" }));
    for (const place of state.catalog.places.filter((item) => item.popular)) {
      const on = state.place?.id === place.id && state.query === place.name;
      wrap.append(el("button", {
        type: "button",
        class: `chip${on ? " is-selected" : ""}`,
        onclick: () => {
          state.point = state.pointSource === "gps" ? state.point : null;
          if (state.pointSource !== "gps") state.pointSource = "";
          choosePlace(place, place.name);
          updateLocation();
        }
      }, [place.name]));
    }
  }

  function updateZones() {
    clear(zoneBlock);
    const zones = state.place?.zones || [];
    if (!zones.length) return;
    zoneBlock.append(
      el("div", { class: "step-row" }, [
        el("h2", { class: "step", text: `2B. ${state.place.name} suburb / locality` }),
        el("span", { class: "active-pill", text: "Active" }),
        el("span", { class: "step-note", text: "Secondary zone filter" })
      ]),
      el("div", { class: "zone-grid" }, [
        zoneButton("all", "All suburbs", `Entire ${state.place.name}`),
        ...zones.map((zone) => zoneButton(zone.id, zone.name, zone.summary))
      ]),
      el("p", { class: "hint", text: "Choosing a locality focuses the search on that part of town and filters matching routes." })
    );
  }

  function zoneButton(id, name, summary) {
    const on = state.zoneId === id;
    return el("button", {
      type: "button",
      class: `zone-card${on ? " is-selected" : ""}`,
      "aria-pressed": on ? "true" : "false",
      onclick: () => {
        state.zoneId = id;
        state.routeId = "all";
        updateZones();
        updateRoutes();
      }
    }, [el("strong", { text: name }), el("span", { text: summary }), on ? el("i", { class: "zone-dot" }) : null]);
  }

  function filteredRoutes() {
    if (!state.place) return [];
    return state.place.routes.filter((route) => route.transport_type === state.transport && (state.zoneId === "all" || route.zone_id === state.zoneId));
  }

  function focusPoint() {
    if (state.point) return state.point;
    const zone = state.place?.zones?.find((item) => item.id === state.zoneId);
    if (zone?.lat) return { lat: zone.lat, lng: zone.lng };
    if (state.place) return { lat: state.place.lat, lng: state.place.lng };
    return null;
  }

  function updateRoutes() {
    const routes = filteredRoutes();
    const previous = state.routeId;
    clear(routeSelect);
    const placeName = state.place?.name || "this town";
    routeSelect.append(el("option", { value: "all", text: state.place ? `All routes in ${placeName} (${routes.length} available)` : "Choose a town first" }));
    for (const route of routes) routeSelect.append(el("option", { value: route.id, text: route.name }));
    state.routeId = routes.some((route) => route.id === previous) ? previous : "all";
    routeSelect.value = state.routeId;
    routeSelect.disabled = !state.place;
    routeHint.textContent = state.place
      ? (routes.length ? "You can keep all routes, or pick one. A suggestion appears when we can judge distance." : "No published routes for this selection yet. The association can add them.")
      : "Start with a town. Popular towns are listed under the field.";
    renderChips();
    updateRecommendation();
  }

  function updateRecommendation() {
    const point = focusPoint();
    const ranked = point ? rankRoutes(filteredRoutes(), point) : [];
    clear(recommendBox);
    if (!ranked.length) {
      recommendBox.hidden = true;
      return;
    }
    const best = ranked[0];
    const precise = state.pointSource === "gps" || state.pointSource === "pin" || state.pointSource === "typed";
    recommendBox.hidden = false;
    recommendBox.append(
      el("p", { text: `${best.route.name} is the closest published corridor to ${precise ? "your pin" : "the area you selected"}, about ${formatDistance(best.distance)} away.` }),
      el("div", { class: "recommend-actions" }, [
        el("button", { type: "button", class: "text-button", onclick: () => acceptRecommendation(best.route.id) }, ["Use this route"]),
        el("button", { type: "button", class: "text-button muted", onclick: () => skipRecommendation() }, ["I'll decide"])
      ])
    );
  }

  function acceptRecommendation(id) {
    state.routeId = id;
    routeSelect.value = id;
    state.followHint = true;
    track("recommendation_accept", { city: state.place?.name, transport: state.transport, routeId: id });
  }

  function skipRecommendation() {
    state.followHint = false;
    recommendBox.hidden = true;
    track("recommendation_skip", { city: state.place?.name, transport: state.transport, routeId: state.routeId === "all" ? null : state.routeId });
  }

  function updateLocation() {
    const point = state.point;
    if (!point) {
      locationLabel.textContent = state.place ? `Location is off. We'll use ${state.place.name} centre unless you pin a spot.` : "Turn location on, pin the map, or type a place such as Riverwalk.";
      updateRecommendation();
      return;
    }
    const near = nearestLandmark(state.place?.landmarks, point);
    const source = state.pointSource === "gps" ? "Current location" : state.pointSource === "pin" ? "Pinned" : "Entered place";
    locationLabel.textContent = near ? `${source}: near ${near.landmark.name} (${formatDistance(near.distance)}).` : `${source} set. Recommendations use this point.`;
    updateRecommendation();
  }

  function stopGps() {
    state.watchStop?.();
    state.watchStop = null;
  }

  function toggleGps() {
    if (state.pointSource === "gps") {
      stopGps();
      state.point = null;
      state.pointSource = "";
      updateLocation();
      return;
    }
    if (!navigator.geolocation) {
      locationLabel.textContent = "This browser cannot share location. Pin the map or type a place.";
      return;
    }
    locationLabel.textContent = "Finding your location…";
    stopGps();
    state.watchStop = navigator.geolocation.watchPosition((position) => {
      state.point = { lat: position.coords.latitude, lng: position.coords.longitude };
      state.pointSource = "gps";
      updateLocation();
      track("location_set", { city: state.place?.name, transport: state.transport });
    }, () => {
      state.pointSource = "";
      locationLabel.textContent = "Location permission was declined. You can still pin the map or type a place.";
    }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 12000 });
  }

  function openResults({ pinFirst }) {
    if (!state.place) {
      routeHint.textContent = "Choose a town before searching.";
      form.querySelector("#place-input").focus();
      return;
    }
    const routes = filteredRoutes();
    const point = focusPoint();
    const ranked = point ? rankRoutes(routes, point) : routes.map((route) => ({ route, distance: null }));
    const chosen = state.routeId === "all" ? ranked[0]?.route : routes.find((route) => route.id === state.routeId) || ranked[0]?.route;
    if (chosen && state.routeId !== "all" && ranked[0] && chosen.id !== ranked[0].route.id) {
      track("recommendation_skip", { city: state.place.name, transport: state.transport, routeId: chosen.id });
    } else if (chosen && ranked[0] && chosen.id === ranked[0].route.id) {
      track("recommendation_accept", { city: state.place.name, transport: state.transport, routeId: chosen.id });
    }
    track("search", { city: state.place.name, transport: state.transport, routeId: chosen?.id || null });
    form.hidden = true;
    results.hidden = false;
    history.pushState({ nako: "results" }, "");
    renderResults({ ranked, chosen, pinFirst, point });
  }

  let map;
  let layer;
  let frame;

  function destroyMap() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (map) map.remove();
    map = null;
    layer = null;
  }

  function renderResults({ ranked, chosen, pinFirst, point }) {
    destroyMap();
    clear(results);
    state.searching = true;
    state.selectedVehicle = null;
    const working = ranked.length ? ranked : [];
    const active = chosen || working[0]?.route || null;
    const distance = working.find((item) => item.route.id === active?.id)?.distance;
    state.baseFleet = simulateFleet({
      routes: [active, working.find((item) => item.route.id !== active?.id)?.route].filter(Boolean),
      point,
      distanceTo: distance,
      type: state.transport
    });
    state.fleet = state.baseFleet;
    const routesForAnim = [active, working[1]?.route].filter(Boolean);

    const mapCanvas = el("div", { class: "map-canvas" });
    const sheet = el("section", { class: "sheet" });
    const searchVeil = el("div", { class: "veil" }, [
      el("div", { class: "radar" }),
      el("p", { text: "Checking the rank near you" }),
      el("span", { text: "Simulated search. Live trackers are not connected yet." })
    ]);
    results.append(
      mapCanvas,
      el("header", { class: "map-bar" }, [
        el("button", { type: "button", class: "back", onclick: () => history.back() }, ["Back"]),
        el("div", {}, [
          el("strong", { text: active ? active.name : "No published route" }),
          el("span", { text: `${state.place.name} · ${labelFor(state.transport)}` })
        ]),
        el("span", { class: "sim-chip", text: "Simulated" })
      ]),
      el("div", { class: "map-tools" }, [
        el("button", { type: "button", class: "tool", onclick: toggleGpsFromMap }, [icon("locate"), "Location"]),
        el("button", { type: "button", class: "tool", id: "pin-tool", onclick: () => setPinMode(true) }, [icon("pin"), "Move pin"])
      ]),
      searchVeil,
      sheet
    );

    const pin = el("div", { class: "center-pin", hidden: !pinFirst });
    results.append(pin);

    function fillSheet(current) {
      clear(sheet);
      const best = working[0];
      const offer = best && current && best.route.id !== current.id;
      const banner = offer ? el("div", { class: "recommend in-sheet" }, [
        el("p", { text: `Closer option: ${best.route.name}, about ${formatDistance(best.distance)} away.` }),
        el("button", { type: "button", class: "text-button", onclick: () => switchRoute(best.route) }, ["Use recommended"]),
        el("button", { type: "button", class: "text-button muted", onclick: () => { banner.remove(); track("recommendation_skip", { city: state.place.name, transport: state.transport, routeId: current.id }); } }, ["Keep my choice"])
      ]) : null;
      const pieces = [
        el("div", { class: "sheet-handle" }),
        el("p", { class: "sheet-kicker", text: state.fleet.length ? `${state.fleet.length} simulated ${labelFor(state.transport)}${state.fleet.length === 1 ? "" : "s"} idling` : "No vehicles to place" }),
        el("h2", { text: current ? current.name : "Routes can be added by the association" }),
        el("p", { class: "sheet-copy", text: current?.summary || "Nothing is published here yet. You can still look around the town centre." }),
        banner,
        el("div", { class: "vehicle-list" }, state.fleet.map((vehicle) => el("button", {
          type: "button",
          class: `vehicle${state.selectedVehicle === vehicle.id ? " is-selected" : ""}`,
          onclick: () => selectVehicle(vehicle)
        }, [
          el("strong", { text: `${labelFor(vehicle.type)} · ${vehicle.plate}` }),
          el("span", { text: `${vehicle.routeName} · Idling · ${formatDistance(haversine(point || focusPoint(), vehicle))}` }),
          el("em", { text: "Simulated" })
        ])))
      ];
      if (working.length > 1) {
        pieces.push(el("label", { class: "sheet-switch", text: "Choose another route" }));
        pieces.push(el("select", {
          "aria-label": "Choose another route",
          onchange: (event) => {
            const next = working.find((item) => item.route.id === event.target.value)?.route;
            if (next) switchRoute(next);
          }
        }, working.map((item) => el("option", { value: item.route.id, selected: item.route.id === current?.id ? "selected" : null, text: item.route.name }))));
      }
      sheet.append(...pieces.filter(Boolean));
    }

    function selectVehicle(vehicle) {
      state.selectedVehicle = vehicle.id;
      layer?.setSelected(vehicle.id);
      map?.easeTo({ center: [vehicle.lng, vehicle.lat], zoom: 16.2, duration: 700 });
      fillSheet(activeRoute());
    }

    let currentRoute = active;
    function activeRoute() { return currentRoute; }

    function switchRoute(route) {
      currentRoute = route;
      state.routeId = route.id;
      const rankedNow = rankRoutes(filteredRoutes(), focusPoint() || point);
      const distanceNow = rankedNow.find((item) => item.route.id === route.id)?.distance;
      const second = rankedNow.find((item) => item.route.id !== route.id)?.route;
      state.baseFleet = simulateFleet({ routes: [route, second].filter(Boolean), point: focusPoint(), distanceTo: distanceNow, type: state.transport });
      state.fleet = state.baseFleet;
      routesForAnim.length = 0;
      routesForAnim.push(...[route, second].filter(Boolean));
      drawRoute(route, rankedNow.map((item) => item.route));
      fillSheet(route);
      focusMap(route);
    }

    function drawRoute(route, all) {
      if (!map?.getSource("corridors")) return;
      map.getSource("corridors").setData({
        type: "FeatureCollection",
        features: (all || []).filter((item) => item?.path?.length).map((item) => ({
          type: "Feature",
          properties: { chosen: item.id === route?.id ? 1 : 0 },
          geometry: { type: "LineString", coordinates: item.path.map((spot) => [spot.lng, spot.lat]) }
        }))
      });
    }

    function focusMap(route) {
      if (!map) return;
      const spot = state.fleet[0] || route?.path?.[0] || focusPoint();
      if (!spot) return;
      const length = route?.path?.reduce((sum, point, index) => index ? sum + haversine(route.path[index - 1], point) : 0, 0) || 0;
      map.easeTo({
        center: [spot.lng, spot.lat],
        zoom: length > 30000 ? 14.8 : 16.2,
        pitch: 62,
        bearing: -24,
        padding: { top: 80, bottom: 360, left: 20, right: 20 },
        duration: 900
      });
    }

    function setPinMode(on) {
      pin.hidden = !on;
      const button = results.querySelector("#pin-tool");
      button.classList.toggle("is-on", on);
      button.onclick = () => setPinMode(!pin.hidden ? false : true);
      if (!on && map) {
        const center = map.getCenter();
        state.point = { lat: center.lat, lng: center.lng };
        state.pointSource = "pin";
        stopGps();
        track("location_set", { city: state.place.name, transport: state.transport });
        switchRoute(currentRoute || active);
      }
    }

    function toggleGpsFromMap() {
      toggleGps();
      setTimeout(() => {
        if (state.point && map) {
          map.easeTo({ center: [state.point.lng, state.point.lat], zoom: 15, duration: 700 });
          switchRoute(currentRoute || active);
        }
      }, 1200);
    }

    fillSheet(active);

    if (!globalThis.maplibregl) {
      searchVeil.hidden = true;
      state.searching = false;
      sheet.prepend(el("p", { class: "hint", text: "The map library did not load. Route details are still available." }));
      return;
    }

    map = new maplibregl.Map({
      container: mapCanvas,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [(point || focusPoint()).lng, (point || focusPoint()).lat],
      zoom: 13.8,
      pitch: 58,
      bearing: -18,
      maxPitch: 68,
      attributionControl: true,
      canvasContextAttributes: { antialias: true }
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.on("load", () => {
      map.resize();
      map.addSource("corridors", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });
      map.addLayer({
        id: "corridor-line",
        type: "line",
        source: "corridors",
        paint: {
          "line-color": ["case", ["==", ["get", "chosen"], 1], "#1f6feb", "#90a4b8"],
          "line-width": ["case", ["==", ["get", "chosen"], 1], 5, 2.5],
          "line-opacity": 0.95
        }
      });
      layer = createVehicleLayer(maplibregl);
      map.addLayer(layer);
      drawRoute(active, working.map((item) => item.route));
      focusMap(active || { path: [point || focusPoint()] });
      const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 300 : 2200;
      window.setTimeout(() => {
        state.searching = false;
        searchVeil.hidden = true;
        if (pinFirst) setPinMode(true);
        loop(performance.now());
      }, delay);
    });

    function loop(now) {
      if (results.hidden) return;
      if (!state.searching && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        state.fleet = animateFleet(state.baseFleet, routesForAnim, now);
      }
      layer?.setVehicles(state.searching ? [] : state.fleet);
      layer?.setSelected(state.selectedVehicle);
      frame = requestAnimationFrame(loop);
    }
  }

  window.addEventListener("popstate", () => {
    if (results.hidden) return;
    results.hidden = true;
    form.hidden = false;
    destroyMap();
    updateLocation();
  });

  onSync(({ catalog, status }) => {
    state.catalog = catalog;
    if (state.place) state.place = catalog.places.find((place) => place.id === state.place.id) || state.place;
    statusEl.textContent = STATUS[status] || "Saved";
    statusEl.dataset.state = status;
    if (!results.hidden) return;
    updateZones();
    updateRoutes();
  });

  const initial = state.catalog.places.find((place) => place.name === "Gaborone");
  if (initial) choosePlace(initial, "Gaborone", "all", true);
  else updateRoutes();
  await startSync();
  trackOnce("app_open", { city: state.place?.name, transport: state.transport });
}

function labelFor(type) {
  if (type === "taxi") return "Taxi";
  if (type === "bus") return "Bus";
  return "Kombi";
}
