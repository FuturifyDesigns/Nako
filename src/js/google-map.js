import { config } from "./config.js";

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
  return {
    native,
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
    remove() { container.replaceChildren(); },
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
  let selected = null;
  function sync(vehicles = []) {
    const ids = new Set(vehicles.map((vehicle) => vehicle.id));
    for (const [id, marker] of markers) {
      if (!ids.has(id)) { marker.setMap(null); markers.delete(id); }
    }
    for (const vehicle of vehicles) {
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
      marker.nakoVehicle = vehicle;
      marker.setPosition({ lat: vehicle.lat, lng: vehicle.lng });
      marker.setZIndex(vehicle.id === selected ? 100 : 10);
      marker.setOpacity(vehicle.id === selected ? 1 : 0.9);
    }
  }
  let latest = [];
  return {
    setVehicles(vehicles) { latest = vehicles || []; sync(latest); },
    setSelected(id) { selected = id; sync(latest); },
    clear() { for (const marker of markers.values()) marker.setMap(null); markers.clear(); }
  };
}
