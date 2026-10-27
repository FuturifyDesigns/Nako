import { el, icon, clear } from "./dom.js";
import { formatDistance, haversine, nearestLandmark, rankRoutes, suggestPlaces } from "./geo.js";
import { getLang, t, toggleLang } from "./i18n.js";
import { simulateFleet } from "./simulate.js";
import { createVehicleLayer } from "./vehicle-layer.js";
import { currentCatalog, onSync, startSync, track, trackOnce } from "./sync.js";

function typeMeta() {
  return [
    { id: "taxi", name: t("taxi"), detail: t("taxiDetail"), icon: "taxi" },
    { id: "kombi", name: t("kombi"), detail: t("kombiDetail"), icon: "kombi" },
    { id: "bus", name: t("bus"), detail: t("busDetail"), icon: "bus" }
  ];
}

function statusLabel(state) {
  if (state === "nearby") return t("statusNearby");
  if (state === "on_way") return t("statusOnWay");
  return t("statusAtRank");
}

function labelFor(type) {
  if (type === "taxi") return t("taxi");
  if (type === "bus") return t("bus");
  return t("kombi");
}

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
    selectedVehicle: null,
    followHint: true,
    hideRecommend: false,
    locationKey: ""
  };

  const shell = el("div", { class: "finder" });
  const form = el("section", { class: "card finder-card" });
  const results = el("section", { class: "results", hidden: true });
  shell.append(form, results);
  root.append(shell);

  const langBtn = el("button", { type: "button", class: "lang-toggle", onclick: () => { toggleLang(); rebuildForm(); } });
  const suggestionBox = el("div", { class: "suggestions", hidden: true });
  const zoneBlock = el("div", { class: "zone-block" });
  const routeSelect = el("select", { id: "route-select", "aria-label": "Route" });
  const routeHint = el("p", { class: "hint" });
  const locationLabel = el("p", { class: "location-label" });
  const recommendBox = el("div", { class: "recommend", hidden: true });
  const typeGrid = el("div", { class: "type-grid" });
  const chips = el("div", { class: "chips", id: "popular-chips" });
  const title = el("h1");
  const lede = el("p", { class: "lede" });
  const stepTransport = el("h2", { class: "step" });
  const stepPlace = el("h2", { class: "step" });
  const stepLocation = el("h2", { class: "step" });
  const stepRoute = el("h2", { class: "step" });
  const routeKind = el("span", { class: "step-note", id: "route-kind" });
  const placeInput = el("input", {
    id: "place-input",
    value: state.query,
    autocomplete: "off",
    "aria-label": "Town",
    oninput: (event) => onQuery(event.target.value),
    onfocus: () => showSuggestions(true)
  });
  const findBtn = el("button", { type: "button", class: "find", onclick: () => openResults({ pinFirst: false }) });
  const useLocBtn = el("button", { type: "button", class: "ghost", onclick: toggleGps });
  const pinBtn = el("button", { type: "button", class: "ghost", onclick: () => openResults({ pinFirst: true }) });

  form.append(
    el("div", { class: "finder-top" }, [langBtn]),
    title,
    lede,
    stepTransport,
    typeGrid,
    stepPlace,
    el("div", { class: "field" }, [
      icon("pin"),
      placeInput,
      el("button", { type: "button", class: "icon-button", "aria-label": "Clear", onclick: () => onQuery("") }, [icon("close")])
    ]),
    suggestionBox,
    chips,
    zoneBlock,
    stepLocation,
    el("div", { class: "location-actions" }, [useLocBtn, pinBtn]),
    locationLabel,
    el("div", { class: "step-row" }, [stepRoute, routeKind]),
    routeSelect,
    routeHint,
    recommendBox,
    findBtn
  );

  function rebuildForm() {
    langBtn.textContent = t("otherLang");
    title.textContent = t("appTitle");
    lede.textContent = t("appLede");
    stepTransport.textContent = t("stepTransport");
    stepPlace.textContent = t("stepPlace");
    stepLocation.textContent = t("stepLocation");
    stepRoute.textContent = t("stepRoute");
    placeInput.placeholder = t("placePlaceholder");
    useLocBtn.replaceChildren(icon("locate"), document.createTextNode(t("useLocation")));
    pinBtn.replaceChildren(icon("pin"), document.createTextNode(t("pinMap")));
    findBtn.replaceChildren(document.createTextNode(t("findTransport")), icon("arrow"));
    clear(typeGrid);
    const art = {
      taxi: "../assets/vehicles/taxi-mark.png?v=4",
      kombi: "../assets/vehicles/kombi-mark.png?v=4",
      bus: "../assets/vehicles/bus-mark.png?v=4"
    };
    for (const type of typeMeta()) {
      const button = el("button", {
        type: "button",
        class: `type-card type-${type.id}${type.id === state.transport ? " is-selected" : ""}`,
        "aria-pressed": type.id === state.transport ? "true" : "false",
        onclick: () => selectTransport(type.id)
      }, [
        el("img", { class: "type-art", src: art[type.id], alt: "", width: "96", height: "64", draggable: "false" }),
        el("strong", { text: type.name }),
        el("span", { text: type.detail })
      ]);
      button.dataset.type = type.id;
      typeGrid.append(button);
    }
    syncLocationButton();
    routeKind.textContent = state.transport === "taxi" ? t("taxiRanks") : state.transport === "bus" ? t("busCorridors") : t("kombiCorridors");
    updateZones();
    updateRoutes();
    updateLocation();
  }

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
    for (const button of typeGrid.querySelectorAll(".type-card")) {
      const on = button.dataset.type === id;
      button.classList.toggle("is-selected", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    }
    routeKind.textContent = id === "taxi" ? t("taxiRanks") : id === "bus" ? t("busCorridors") : t("kombiCorridors");
    track("transport_select", { transport: id, city: state.place?.name });
    updateRoutes();
  }

  function onQuery(value) {
    state.query = value;
    if (placeInput.value !== value) placeInput.value = value;
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
      noteLocationChange(state.point, "typed");
    } else {
      choosePlace(item.place, item.place.name);
    }
    suggestionBox.hidden = true;
    updateLocation();
  }

  function placesGeoJSON() {
    if (!state.place) return { type: "FeatureCollection", features: [] };
    const seen = new Set();
    const features = [];
    const push = (name, lat, lng, kind) => {
      if (lat == null || lng == null || !name) return;
      const key = `${name.toLowerCase()}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
      if (seen.has(key)) return;
      seen.add(key);
      features.push({
        type: "Feature",
        properties: { name, kind },
        geometry: { type: "Point", coordinates: [lng, lat] }
      });
    };
    push(state.place.name, state.place.lat, state.place.lng, "town");
    for (const landmark of state.place.landmarks || []) {
      push(landmark.name, landmark.lat, landmark.lng, "landmark");
    }
    for (const zone of state.place.zones || []) {
      push(zone.name, zone.lat, zone.lng, "zone");
    }
    for (const alias of state.catalog.aliases || []) {
      if (alias.placeId !== state.place.id) continue;
      push(alias.label || alias.q, alias.lat, alias.lng, "place");
    }
    for (const route of state.place.routes || []) {
      const tip = route.path?.[0];
      if (tip) push(route.origin_name || route.name, tip.lat, tip.lng, "stop");
      const end = route.path?.[route.path.length - 1];
      if (end) push(route.destination_name, end.lat, end.lng, "stop");
    }
    return { type: "FeatureCollection", features };
  }

  function bumpPlaceLabels(mapInstance) {
    if (!mapInstance?.getStyle) return;
    const style = mapInstance.getStyle();
    for (const layerDef of style.layers || []) {
      if (layerDef.type !== "symbol") continue;
      const id = layerDef.id || "";
      const field = layerDef.layout?.["text-field"];
      const looksLikePlace =
        /place|settlement|suburb|neighbour|neighborhood|locality|label/i.test(id) ||
        (typeof field === "string" && /name/i.test(field)) ||
        (Array.isArray(field) && JSON.stringify(field).includes("name"));
      if (!looksLikePlace) continue;
      try {
        if (mapInstance.getLayoutProperty(id, "text-size") != null) {
          mapInstance.setLayoutProperty(id, "text-size", [
            "interpolate", ["linear"], ["zoom"],
            10, 11,
            14, 14,
            16, 16
          ]);
        }
        mapInstance.setPaintProperty(id, "text-halo-width", 1.35);
        mapInstance.setPaintProperty(id, "text-halo-color", "#ffffff");
      } catch {
        /* style layer may not expose every property */
      }
    }
  }

  function choosePlace(place, label, zoneId = "all", silent = false) {
    state.place = place;
    state.query = label;
    state.zoneId = zoneId;
    state.routeId = "all";
    placeInput.value = label;
    if (!silent) track("city_select", { city: place.name, transport: state.transport });
    updateZones();
    updateRoutes();
  }

  function renderChips() {
    clear(chips);
    chips.append(el("span", { class: "chip-label", text: t("popular") }));
    for (const place of state.catalog.places.filter((item) => item.popular)) {
      const on = state.place?.id === place.id && state.query === place.name;
      chips.append(el("button", {
        type: "button",
        class: `chip${on ? " is-selected" : ""}`,
        onclick: () => {
          if (state.pointSource !== "gps") {
            state.point = null;
            state.pointSource = "";
            noteLocationChange(null, "");
          }
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
      el("h2", { class: "step", text: t("stepZone", { place: state.place.name }) }),
      el("div", { class: "zone-grid" }, [
        zoneButton("all", t("allSuburbs"), t("entirePlace", { place: state.place.name })),
        ...zones.map((zone) => zoneButton(zone.id, zone.name, zone.summary))
      ])
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
    }, [el("strong", { text: name }), el("span", { text: summary })]);
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
    const placeName = state.place?.name || "";
    routeSelect.append(el("option", {
      value: "all",
      text: state.place ? t("allRoutes", { place: placeName, count: String(routes.length) }) : t("chooseTownFirst")
    }));
    for (const route of routes) routeSelect.append(el("option", { value: route.id, text: route.name }));
    state.routeId = routes.some((route) => route.id === previous) ? previous : "all";
    routeSelect.value = state.routeId;
    routeSelect.disabled = !state.place;
    routeHint.textContent = state.place
      ? (routes.length ? t("routeHintReady") : t("routeHintEmpty"))
      : t("routeHintStart");
    renderChips();
    updateRecommendation();
  }

  function updateRecommendation() {
    clear(recommendBox);
    if (state.hideRecommend) {
      recommendBox.hidden = true;
      return;
    }
    const point = focusPoint();
    const ranked = point ? rankRoutes(filteredRoutes(), point) : [];
    if (!ranked.length) {
      recommendBox.hidden = true;
      return;
    }
    const best = ranked[0];
    recommendBox.hidden = false;
    recommendBox.append(
      el("p", { text: t("closestRoute", { name: best.route.name, distance: formatDistance(best.distance) }) }),
      el("div", { class: "recommend-actions" }, [
        el("button", { type: "button", class: "text-button", onclick: () => acceptRecommendation(best.route.id) }, [t("useRoute")]),
        el("button", { type: "button", class: "text-button muted", onclick: () => skipRecommendation() }, [t("illDecide")])
      ])
    );
  }

  function acceptRecommendation(id) {
    state.routeId = id;
    routeSelect.value = id;
    state.followHint = true;
    state.hideRecommend = true;
    clear(recommendBox);
    recommendBox.hidden = true;
    track("recommendation_accept", { city: state.place?.name, transport: state.transport, routeId: id });
  }

  function skipRecommendation() {
    state.followHint = false;
    state.hideRecommend = true;
    clear(recommendBox);
    recommendBox.hidden = true;
    track("recommendation_skip", { city: state.place?.name, transport: state.transport, routeId: state.routeId === "all" ? null : state.routeId });
  }

  function locationFingerprint(point, source) {
    if (!point) return "";
    return `${source}:${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
  }

  function noteLocationChange(point, source) {
    const key = locationFingerprint(point, source);
    if (key !== state.locationKey) {
      state.locationKey = key;
      state.hideRecommend = false;
    }
  }

  function syncLocationButton() {
    const on = state.pointSource === "gps" && !!state.point;
    useLocBtn.classList.toggle("is-on", on);
    useLocBtn.replaceChildren(
      icon("locate"),
      document.createTextNode(on ? t("locationCurrent") : t("useLocation"))
    );
  }

  function applyGpsFix(position, trackEvent = true) {
    state.point = { lat: position.coords.latitude, lng: position.coords.longitude };
    state.pointSource = "gps";
    noteLocationChange(state.point, "gps");
    updateLocation();
    syncLocationButton();
    if (trackEvent) track("location_set", { city: state.place?.name, transport: state.transport });
  }

  function updateLocation() {
    const point = state.point;
    syncLocationButton();
    if (!point) {
      locationLabel.textContent = state.place
        ? t("locationOffPlace", { place: state.place.name })
        : t("locationHint");
      updateRecommendation();
      return;
    }
    const near = nearestLandmark(state.place?.landmarks, point);
    const source = state.pointSource === "gps" ? t("locationCurrent") : state.pointSource === "pin" ? t("locationPinned") : t("locationTyped");
    locationLabel.textContent = near
      ? t("nearLandmark", { source, name: near.landmark.name, distance: formatDistance(near.distance) })
      : t("locationSet", { source });
    updateRecommendation();
  }

  function stopGps() {
    state.watchStop?.();
    state.watchStop = null;
  }

  function toggleGps() {
    if (state.pointSource === "gps" && state.point) {
      stopGps();
      state.point = null;
      state.pointSource = "";
      noteLocationChange(null, "");
      updateLocation();
      return;
    }
    if (!navigator.geolocation) {
      locationLabel.textContent = t("locationDenied");
      return;
    }
    locationLabel.textContent = t("locationFinding");
    stopGps();
    const options = { enableHighAccuracy: true, maximumAge: 60000, timeout: 20000 };
    navigator.geolocation.getCurrentPosition((position) => {
      applyGpsFix(position, true);
      state.watchStop = navigator.geolocation.watchPosition(
        (next) => applyGpsFix(next, false),
        () => {},
        options
      );
    }, () => {
      // Fall back to watch if a one-shot read fails (common when permission was just granted)
      state.watchStop = navigator.geolocation.watchPosition(
        (position) => applyGpsFix(position, true),
        () => {
          if (!state.point) {
            state.pointSource = "";
            locationLabel.textContent = t("locationDenied");
            syncLocationButton();
          }
        },
        options
      );
    }, options);
  }

  function openResults({ pinFirst }) {
    if (!state.place) {
      routeHint.textContent = t("routeHintNeedTown");
      placeInput.focus();
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

  function destroyMap() {
    layer?.clear?.();
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
    state.fleet = simulateFleet({
      routes: [active, working.find((item) => item.route.id !== active?.id)?.route].filter(Boolean),
      point,
      distanceTo: distance,
      type: state.transport
    });

    const mapCanvas = el("div", { class: "map-canvas" });
    const sheet = el("section", { class: "sheet is-open" });
    const sheetBody = el("div", { class: "sheet-body" });
    const searchVeil = el("div", { class: "veil" }, [
      el("div", { class: "radar" }),
      el("p", { text: t("checkingRank") })
    ]);
    const pickupLabel = el("div", { class: "pickup-label", hidden: true }, [
      el("span", { class: "pickup-kicker", text: t("pickup") }),
      el("strong", { class: "pickup-name", text: state.place.name })
    ]);
    const mapTools = el("div", { class: "map-tools" }, [
      el("button", { type: "button", class: "tool", "aria-label": t("location"), onclick: toggleGpsFromMap }, [icon("locate")]),
      el("button", { type: "button", class: "tool", id: "pin-tool", "aria-label": t("movePin"), onclick: () => setPinMode(true) }, [icon("pin")])
    ]);

    let userCollapsed = false;
    let sheetHideTimer = 0;
    let mapMoving = false;

    function setSheetHidden(hidden) {
      sheet.classList.toggle("is-hidden", hidden);
      sheet.classList.toggle("is-open", !hidden);
      results.classList.toggle("sheet-collapsed", hidden);
    }

    function hideSheetForMapMove() {
      if (mapMoving) return;
      mapMoving = true;
      window.clearTimeout(sheetHideTimer);
      setSheetHidden(true);
    }

    function showSheetAfterMapIdle() {
      mapMoving = false;
      window.clearTimeout(sheetHideTimer);
      sheetHideTimer = window.setTimeout(() => {
        if (!mapMoving && !userCollapsed) setSheetHidden(false);
      }, 520);
    }

    function openDirections(vehicle) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${vehicle.lat},${vehicle.lng}&travelmode=walking`;
      window.open(url, "_blank", "noopener,noreferrer");
      track("directions_open", { city: state.place?.name, transport: state.transport, routeId: vehicle.routeId });
    }

    const sheetHandle = el("button", {
      type: "button",
      class: "sheet-handle",
      "aria-label": "Toggle details",
      onclick: () => {
        userCollapsed = !sheet.classList.contains("is-hidden") ? true : false;
        // If currently open → user wants it closed. If hidden → user wants it open.
        const hide = !sheet.classList.contains("is-hidden");
        userCollapsed = hide;
        setSheetHidden(hide);
      }
    });
    sheet.append(sheetHandle, sheetBody);

    results.append(
      mapCanvas,
      el("header", { class: "map-bar" }, [
        el("button", { type: "button", class: "back", onclick: () => history.back() }, [t("back")]),
        el("div", {}, [
          el("strong", { text: active ? active.name : t("noRoute") }),
          el("span", { text: `${state.place.name} · ${labelFor(state.transport)}` })
        ])
      ]),
      mapTools,
      pickupLabel,
      searchVeil,
      sheet
    );

    const pin = el("div", { class: "center-pin", hidden: !pinFirst });
    results.append(pin);

    function fillSheet(current) {
      clear(sheetBody);
      const best = working[0];
      const offer = best && current && best.route.id !== current.id;
      const banner = offer ? el("div", { class: "recommend in-sheet" }, [
        el("p", { text: t("closerOption", { name: best.route.name, distance: formatDistance(best.distance) }) }),
        el("button", { type: "button", class: "text-button", onclick: () => switchRoute(best.route) }, [t("useRecommended")]),
        el("button", { type: "button", class: "text-button muted", onclick: () => { banner.remove(); track("recommendation_skip", { city: state.place.name, transport: state.transport, routeId: current.id }); } }, [t("keepChoice")])
      ]) : null;
      const pieces = [
        el("p", {
          class: "sheet-kicker",
          text: state.fleet.length ? t("vehiclesNearby", { count: String(state.fleet.length) }) : t("noVehicles")
        }),
        el("h2", { text: current ? current.name : t("routesCanBeAdded") }),
        el("p", { class: "sheet-copy", text: current?.summary || t("nothingPublished") }),
        banner,
        el("div", { class: "vehicle-list" }, state.fleet.map((vehicle) => {
          const selected = state.selectedVehicle === vehicle.id;
          return el("div", { class: `vehicle-block${selected ? " is-selected" : ""}` }, [
            el("button", {
              type: "button",
              class: `vehicle${selected ? " is-selected" : ""}`,
              onclick: () => selectVehicle(vehicle)
            }, [
              el("strong", { text: `${labelFor(vehicle.type)} · ${vehicle.plate}` }),
              el("span", { text: `${vehicle.routeName} · ${statusLabel(vehicle.state)}${vehicle.distance != null ? ` · ${formatDistance(vehicle.distance)}` : ""}` })
            ]),
            selected ? el("button", {
              type: "button",
              class: "directions-btn",
              onclick: () => openDirections(vehicle)
            }, [t("getDirections")]) : null
          ]);
        }))
      ];
      if (working.length > 1) {
        pieces.splice(3, 0, el("div", { class: "sheet-route-switch" }, [
          el("label", { class: "sheet-switch", text: t("otherRoute") }),
          el("select", {
            "aria-label": t("otherRoute"),
            onchange: (event) => {
              const next = working.find((item) => item.route.id === event.target.value)?.route;
              if (next) switchRoute(next);
            }
          }, working.map((item) => el("option", {
            value: item.route.id,
            selected: item.route.id === current?.id ? "selected" : null,
            text: item.route.name
          })))
        ]));
      }
      sheetBody.append(...pieces.filter(Boolean));
    }

    function selectVehicle(vehicle) {
      state.selectedVehicle = vehicle.id;
      layer?.setSelected(vehicle.id);
      map?.easeTo({ center: [vehicle.lng, vehicle.lat], zoom: 16.1, duration: 450 });
      fillSheet(activeRoute());
      setSheetHidden(false);
      userCollapsed = false;
    }

    let currentRoute = active;
    function activeRoute() { return currentRoute; }

    function switchRoute(route) {
      currentRoute = route;
      state.routeId = route.id;
      const rankedNow = rankRoutes(filteredRoutes(), focusPoint() || point);
      const distanceNow = rankedNow.find((item) => item.route.id === route.id)?.distance;
      const second = rankedNow.find((item) => item.route.id !== route.id)?.route;
      state.fleet = simulateFleet({
        routes: [route, second].filter(Boolean),
        point: focusPoint(),
        distanceTo: distanceNow,
        type: state.transport
      });
      drawRoute(route);
      layer?.setVehicles(state.fleet);
      layer?.setSelected(state.selectedVehicle);
      fillSheet(route);
      focusMap(route);
      updatePickup();
    }

    function simplifyPath(path, maxPoints = 48) {
      if (!path?.length) return [];
      if (path.length <= maxPoints) return path.map((spot) => [spot.lng, spot.lat]);
      const step = (path.length - 1) / (maxPoints - 1);
      const coords = [];
      for (let i = 0; i < maxPoints; i += 1) {
        const spot = path[Math.round(i * step)];
        coords.push([spot.lng, spot.lat]);
      }
      return coords;
    }

    function drawRoute(route) {
      if (!map?.getSource("corridors")) return;
      // One tidy corridor only — extra overlapping routes looked scattered.
      const features = route?.path?.length ? [{
        type: "Feature",
        properties: { chosen: 1 },
        geometry: { type: "LineString", coordinates: simplifyPath(route.path) }
      }] : [];
      map.getSource("corridors").setData({ type: "FeatureCollection", features });
    }

    function focusMap(route) {
      if (!map) return;
      const spot = state.fleet[0] || route?.path?.[0] || focusPoint();
      if (!spot) return;
      const length = route?.path?.reduce((sum, spotItem, index) => index ? sum + haversine(route.path[index - 1], spotItem) : 0, 0) || 0;
      map.easeTo({
        center: [spot.lng, spot.lat],
        zoom: length > 30000 ? 13.8 : 15.2,
        pitch: 0,
        bearing: 0,
        padding: { top: 80, bottom: 340, left: 24, right: 24 },
        duration: 700
      });
    }

    function updatePickup() {
      // Only show for an explicit pin/GPS/typed spot — not the default town centre.
      const explicit = state.pointSource === "gps" || state.pointSource === "pin" || state.pointSource === "typed";
      const pt = explicit ? state.point : null;
      if (!pt) {
        pickupLabel.hidden = true;
        pickupLabel.classList.remove("is-visible");
        return;
      }
      pickupLabel.hidden = false;
      const name = pickupLabel.querySelector(".pickup-name");
      const near = nearestLandmark(state.place?.landmarks, pt);
      if (name) name.textContent = near?.landmark?.name || t("pickup");
      requestAnimationFrame(() => pickupLabel.classList.add("is-visible"));
    }

    function setPinMode(on) {
      pin.hidden = !on;
      const button = results.querySelector("#pin-tool");
      button.classList.toggle("is-on", on);
      button.onclick = () => setPinMode(pin.hidden);
      if (!on && map) {
        const center = map.getCenter();
        state.point = { lat: center.lat, lng: center.lng };
        state.pointSource = "pin";
        stopGps();
        noteLocationChange(state.point, "pin");
        track("location_set", { city: state.place.name, transport: state.transport });
        switchRoute(currentRoute || active);
      }
    }

    function toggleGpsFromMap() {
      toggleGps();
      const wait = (tries = 0) => {
        if (state.point && map) {
          map.easeTo({ center: [state.point.lng, state.point.lat], zoom: 15, duration: 700 });
          switchRoute(currentRoute || active);
          return;
        }
        if (tries < 20) window.setTimeout(() => wait(tries + 1), 250);
      };
      wait();
    }

    fillSheet(active);
    updatePickup();

    if (!globalThis.maplibregl) {
      searchVeil.hidden = true;
      state.searching = false;
      sheet.prepend(el("p", { class: "hint", text: "Map unavailable." }));
      return;
    }

    map = new maplibregl.Map({
      container: mapCanvas,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [(point || focusPoint()).lng, (point || focusPoint()).lat],
      zoom: 13.6,
      pitch: 0,
      bearing: 0,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      renderWorldCopies: false,
      fadeDuration: 0,
      attributionControl: true,
      canvasContextAttributes: { antialias: false }
    });
    map.touchZoomRotate.disableRotation();
    map.on("load", () => {
      map.resize();
      bumpPlaceLabels(map);
      map.addSource("corridors", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });
      map.addLayer({
        id: "corridor-halo",
        type: "line",
        source: "corridors",
        layout: {
          "line-cap": "round",
          "line-join": "round"
        },
        paint: {
          "line-color": "#ffffff",
          "line-width": 8,
          "line-opacity": 0.9
        }
      });
      map.addLayer({
        id: "corridor-line",
        type: "line",
        source: "corridors",
        layout: {
          "line-cap": "round",
          "line-join": "round"
        },
        paint: {
          "line-color": "#1f6feb",
          "line-width": 4,
          "line-opacity": 1
        }
      });
      map.addSource("nako-places", {
        type: "geojson",
        data: placesGeoJSON()
      });
      map.addLayer({
        id: "nako-places-dot",
        type: "circle",
        source: "nako-places",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3, 15, 5.5],
          "circle-color": "#1f6feb",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff"
        }
      });
      map.addLayer({
        id: "nako-places-label",
        type: "symbol",
        source: "nako-places",
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 11, 11, 15, 13],
          "text-offset": [0, 1.05],
          "text-anchor": "top",
          "text-optional": true,
          "text-padding": 2
        },
        paint: {
          "text-color": "#122033",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.4
        }
      });
      layer = createVehicleLayer(map, maplibregl, {
        onSelect: (vehicle) => selectVehicle(vehicle)
      });
      drawRoute(active);
      layer.setVehicles(state.fleet);
      layer.setSelected(state.selectedVehicle);
      focusMap(active || { path: [point || focusPoint()] });

      // Only tuck the sheet on drag — zooming used to thrash layout every frame.
      map.on("dragstart", hideSheetForMapMove);
      map.on("dragend", showSheetAfterMapIdle);

      const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 120 : 700;
      window.setTimeout(() => {
        state.searching = false;
        searchVeil.hidden = true;
        if (pinFirst) setPinMode(true);
      }, delay);
    });
  }

  window.addEventListener("popstate", () => {
    if (results.hidden) return;
    results.hidden = true;
    form.hidden = false;
    destroyMap();
    updateLocation();
  });

  onSync(({ catalog }) => {
    state.catalog = catalog;
    if (state.place) state.place = catalog.places.find((place) => place.id === state.place.id) || state.place;
    if (!results.hidden) return;
    updateZones();
    updateRoutes();
  });

  document.addEventListener("nako-lang", () => {
    if (!results.hidden) return;
    rebuildForm();
  });

  rebuildForm();
  const initial = state.catalog.places.find((place) => place.name === "Gaborone");
  if (initial) choosePlace(initial, "Gaborone", "all", true);
  else updateRoutes();
  await startSync();
  trackOnce("app_open", { city: state.place?.name, transport: state.transport, lang: getLang() });
}
