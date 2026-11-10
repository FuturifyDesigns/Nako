const ASSETS = {
  taxi: "../assets/vehicles/taxi-mark.png?v=5",
  kombi: "../assets/vehicles/kombi-mark.png?v=5",
  bus: "../assets/vehicles/bus-mark.png?v=5"
};

const SOURCE_ID = "nako-vehicles";
const HALO_ID = "nako-vehicles-halo";
const LAYER_ID = "nako-vehicles-icons";

function iconId(type) {
  if (type === "taxi") return "nako-taxi";
  if (type === "bus") return "nako-bus";
  return "nako-kombi";
}

function loadImage(map, url) {
  return map.loadImage(url).then((result) => result?.data || result);
}

function toFeatureCollection(vehicles, selected, highlightedRoute) {
  return {
    type: "FeatureCollection",
    features: (vehicles || []).map((vehicle) => {
      const type = vehicle.type === "taxi" || vehicle.type === "bus" ? vehicle.type : "kombi";
      return {
        type: "Feature",
        id: vehicle.id,
        properties: {
          id: vehicle.id,
          icon: iconId(type),
          selected: vehicle.id === selected ? 1 : 0,
          routeMatch: highlightedRoute === "all" || (vehicle.routeIds || []).includes(highlightedRoute) ? 1 : 0
        },
        geometry: {
          type: "Point",
          coordinates: [vehicle.lng, vehicle.lat]
        }
      };
    })
  };
}

export function createVehicleLayer(map, _maplibregl, { onSelect } = {}) {
  let vehicles = [];
  let selected = null;
  let highlightedRoute = "all";
  let clickBound = false;
  let animationFrame = 0;
  let targetVehicles = [];

  const stopAnimationForCamera = () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    if (targetVehicles.length) {
      vehicles = targetVehicles;
      sync();
    }
  };
  map.on("zoomstart", stopAnimationForCamera);

  const ready = (async () => {
    for (const [type, url] of Object.entries(ASSETS)) {
      const id = iconId(type);
      if (map.hasImage(id)) continue;
      try {
        const image = await loadImage(map, url);
        if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: 2 });
      } catch (error) {
        console.warn("NakoLive vehicle icon failed to load", type, error);
      }
    }

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: toFeatureCollection(vehicles, selected, highlightedRoute)
      });
    }

    if (!map.getLayer(HALO_ID)) {
      map.addLayer({
        id: HALO_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["get", "selected"], 1],
        paint: {
          "circle-radius": 26,
          "circle-color": "#4ea1ff",
          "circle-opacity": 0.2,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#4ea1ff"
        }
      });
    }

    if (!map.getLayer(LAYER_ID)) {
      map.addLayer({
        id: LAYER_ID,
        type: "symbol",
        source: SOURCE_ID,
        layout: {
          "icon-image": ["get", "icon"],
          "icon-size": [
            "interpolate", ["linear"], ["zoom"],
            12, 0.48,
            14, 0.62,
            16, 0.78,
            18, 0.9
          ],
          "icon-anchor": "center",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-pitch-alignment": "viewport",
          "icon-rotation-alignment": "viewport"
        },
        paint: {
          "icon-opacity": ["case", ["any", ["==", ["get", "selected"], 1], ["==", ["get", "routeMatch"], 1]], 1, 0.34]
        }
      });
    }

    if (!clickBound) {
      clickBound = true;
      map.on("click", LAYER_ID, (event) => {
        const id = event.features?.[0]?.properties?.id;
        const vehicle = vehicles.find((item) => item.id === id);
        if (vehicle) onSelect?.(vehicle);
      });
      map.on("mouseenter", LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
    }
  })();

  function sync() {
    const source = map.getSource(SOURCE_ID);
    if (source) source.setData(toFeatureCollection(vehicles, selected, highlightedRoute));
  }

  return {
    async setVehicles(next) {
      const target = next || [];
      targetVehicles = target;
      await ready;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (map.isMoving?.()) {
        vehicles = target;
        sync();
        return;
      }
      const previous = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
      const started = performance.now();
      const duration = 2600;
      const animate = (time) => {
        const progress = Math.min(1, (time - started) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        vehicles = target.map((vehicle) => {
          const from = previous.get(vehicle.id);
          if (!from) return vehicle;
          return {
            ...vehicle,
            lat: Number(from.lat) + (Number(vehicle.lat) - Number(from.lat)) * eased,
            lng: Number(from.lng) + (Number(vehicle.lng) - Number(from.lng)) * eased
          };
        });
        sync();
        animationFrame = progress < 1 ? requestAnimationFrame(animate) : 0;
      };
      animationFrame = requestAnimationFrame(animate);
    },
    async setSelected(id) {
      selected = id;
      await ready;
      sync();
    },
    async setHighlightedRoute(id) {
      highlightedRoute = id || "all";
      await ready;
      sync();
    },
    clear() {
      map.off("zoomstart", stopAnimationForCamera);
      if (animationFrame) cancelAnimationFrame(animationFrame);
      vehicles = [];
      selected = null;
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      if (map.getLayer(HALO_ID)) map.removeLayer(HALO_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      for (const type of Object.keys(ASSETS)) {
        const id = iconId(type);
        if (map.hasImage(id)) map.removeImage(id);
      }
    }
  };
}
