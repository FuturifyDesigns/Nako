import { config } from "./config.js";
import { vehicleBearing } from "./vehicle-heading.js";

let loading;

export function googleMapsConfigured() {
  return Boolean(config.googleMapsApiKey) && navigator.onLine;
}

export function loadGoogleMaps() {
  if (globalThis.google?.maps?.Map) return Promise.resolve(globalThis.google.maps);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const callback = `nakoGoogleMapsReady_${crypto.randomUUID().replaceAll("-", "")}`;
    globalThis[callback] = () => {
      delete globalThis[callback];
      resolve(globalThis.google.maps);
    };
    const script = document.createElement("script");
    const params = new URLSearchParams({ key: config.googleMapsApiKey, loading: "async", callback, v: "quarterly" });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error("Google Maps could not load"));
    };
    document.head.append(script);
  });
  return loading;
}

export async function createGoogleMap(container, { center, zoom = 14 } = {}) {
  const maps = await loadGoogleMaps();
  const native = new maps.Map(container, {
    center: { lat: center.lat, lng: center.lng }, zoom,
    // Use Google's lightweight raster roadmap on mobile. The cloud map ID was
    // configured as vector and caused expensive WebGL zoom rendering.
    renderingType: maps.RenderingType?.RASTER || "RASTER",
    mapTypeId: "roadmap",
    isFractionalZoomEnabled: false,
    minZoom: 10,
    maxZoom: 18,
    backgroundColor: "#e8edf2",
    disableDefaultUI: true, zoomControl: true, gestureHandling: "greedy",
    clickableIcons: false, streetViewControl: false, mapTypeControl: false,
    fullscreenControl: false
  });
  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      callback();
    };
    maps.event.addListenerOnce(native, "tilesloaded", () => finish(resolve));
    const timer = window.setTimeout(() => finish(() => reject(new Error("Google Maps tiles timed out"))), 7000);
  });
  let pendingCameraOffset = null;
  let cameraMoving = false;
  let userMarker = null;
  maps.event.addListener(native, "zoom_changed", () => { cameraMoving = true; });
  maps.event.addListener(native, "dragstart", () => { cameraMoving = true; });
  maps.event.addListener(native, "idle", () => { cameraMoving = false; });
  return {
    native,
    isCameraMoving() { return cameraMoving; },
    setUserLocation(point) {
      if (!point) {
        userMarker?.setMap(null);
        userMarker = null;
        return;
      }
      if (!userMarker) {
        userMarker = new maps.Marker({
          map: native,
          title: "Your location",
          zIndex: 250,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: "#1657d6",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeOpacity: 1,
            strokeWeight: 4
          }
        });
      }
      userMarker.setPosition({ lat: Number(point.lat), lng: Number(point.lng) });
    },
    easeTo(options = {}) {
      if (pendingCameraOffset) {
        maps.event.removeListener(pendingCameraOffset);
        pendingCameraOffset = null;
      }
      if (options.zoom) native.setZoom(options.zoom);
      if (options.center) {
        native.panTo({ lat: options.center[1], lng: options.center[0] });
        const padding = options.padding;
        if (padding) {
          const offsetX = ((padding.right || 0) - (padding.left || 0)) / 2;
          const offsetY = ((padding.bottom || 0) - (padding.top || 0)) / 2;
          pendingCameraOffset = maps.event.addListenerOnce(native, "idle", () => {
            pendingCameraOffset = null;
            if (Math.abs(offsetX) > 1 || Math.abs(offsetY) > 1) native.panBy(offsetX, offsetY);
          });
        }
      }
    },
    getCenter() {
      const point = native.getCenter();
      return { lat: point.lat(), lng: point.lng() };
    },
    remove() { userMarker?.setMap(null); userMarker = null; container.replaceChildren(); },
    resize() { globalThis.google.maps.event.trigger(native, "resize"); }
  };
}

const ICONS = {
  taxi: "../assets/vehicles/taxi-mark.png?v=5",
  kombi: "../assets/vehicles/kombi-mark.png?v=5",
  bus: "../assets/vehicles/bus-mark.png?v=5"
};

export function createGoogleVehicleLayer(mapAdapter, { onSelect } = {}) {
  const markers = new Map();
  const images = new Map();
  const rotatedIcons = new Map();
  let disposed = false;
  for (const [type, url] of Object.entries(ICONS)) {
    const image = new Image();
    image.onload = () => { images.set(type, image); if (!disposed) sync(latest); };
    image.src = url;
  }
  function vehicleIcon(type, bearing) {
    const image = images.get(type);
    if (!image) return { url: ICONS[type] || ICONS.kombi, scaledSize: new google.maps.Size(54, 36), anchor: new google.maps.Point(27, 18) };
    // Original artwork faces right (east). Quantize rotation to reuse a small
    // image cache instead of redrawing artwork on every location update.
    const angle = Math.round(bearing / 10) * 10 % 360;
    const key = `${type}:${angle}`;
    if (!rotatedIcons.has(key)) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 144;
      const context = canvas.getContext("2d");
      context.translate(72, 72);
      context.rotate((angle - 90) * Math.PI / 180);
      context.drawImage(image, -54, -36, 108, 72);
      rotatedIcons.set(key, { url: canvas.toDataURL("image/png"), scaledSize: new google.maps.Size(72, 72), anchor: new google.maps.Point(36, 36) });
    }
    return rotatedIcons.get(key);
  }
  let selected = null;
  let highlightedRoute = "all";
  const zoomListener = globalThis.google.maps.event.addListener(mapAdapter.native, "zoom_changed", () => {
    for (const marker of markers.values()) {
      if (marker.nakoAnimation) cancelAnimationFrame(marker.nakoAnimation);
      marker.nakoAnimation = null;
      const vehicle = marker.nakoVehicle;
      if (vehicle) marker.setPosition({ lat: Number(vehicle.lat), lng: Number(vehicle.lng) });
    }
  });
  function moveMarker(marker, vehicle) {
    const target = { lat: Number(vehicle.lat), lng: Number(vehicle.lng) };
    const current = marker.getPosition();
    if (!current) { marker.setPosition(target); return; }
    if (marker.nakoAnimation) cancelAnimationFrame(marker.nakoAnimation);
    if (mapAdapter.isCameraMoving?.()) { marker.setPosition(target); return; }
    const from = { lat: current.lat(), lng: current.lng() };
    const jump = Math.abs(target.lat - from.lat) + Math.abs(target.lng - from.lng) > 0.08;
    if (jump) { marker.setPosition(target); return; }
    const started = performance.now();
    const duration = 2600;
    const frame = (time) => {
      const progress = Math.min(1, (time - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      marker.setPosition({
        lat: from.lat + (target.lat - from.lat) * eased,
        lng: from.lng + (target.lng - from.lng) * eased
      });
      marker.nakoAnimation = progress < 1 ? requestAnimationFrame(frame) : null;
    };
    marker.nakoAnimation = requestAnimationFrame(frame);
  }
  function sync(vehicles = []) {
    const ids = new Set(vehicles.map((vehicle) => vehicle.id));
    for (const [id, marker] of markers) {
      if (!ids.has(id)) { marker.setMap(null); markers.delete(id); }
    }
    for (let vehicle of vehicles) {
      let marker = markers.get(vehicle.id);
      if (!marker) {
        marker = new globalThis.google.maps.Marker({
          map: mapAdapter.native,
          title: `${vehicle.type} ${vehicle.plate}`,
          optimized: true,
          icon: { url: ICONS[vehicle.type] || ICONS.kombi, scaledSize: new globalThis.google.maps.Size(54, 36), anchor: new globalThis.google.maps.Point(27, 18) }
        });
        marker.addListener("click", () => onSelect?.(marker.nakoVehicle));
        markers.set(vehicle.id, marker);
      }
      const bearing = vehicleBearing(vehicle, marker.nakoVehicle);
      vehicle = { ...vehicle, bearing };
      marker.setIcon(vehicleIcon(vehicle.type, bearing));
      marker.nakoVehicle = vehicle;
      moveMarker(marker, vehicle);
      const routeMatch = highlightedRoute === "all" || (vehicle.routeIds || []).includes(highlightedRoute);
      marker.setZIndex(vehicle.id === selected ? 100 : routeMatch ? 20 : 10);
      marker.setOpacity(vehicle.id === selected || routeMatch ? 1 : 0.34);
    }
  }
  let latest = [];
  return {
    setVehicles(vehicles) { latest = vehicles || []; sync(latest); },
    setSelected(id) { selected = id; sync(latest); },
    setHighlightedRoute(id) { highlightedRoute = id || "all"; sync(latest); },
    clear() {
      disposed = true;
      rotatedIcons.clear();
      globalThis.google.maps.event.removeListener(zoomListener);
      for (const marker of markers.values()) {
        if (marker.nakoAnimation) cancelAnimationFrame(marker.nakoAnimation);
        marker.setMap(null);
      }
      markers.clear();
    }
  };
}
