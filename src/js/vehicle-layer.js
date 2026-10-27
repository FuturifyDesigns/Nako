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

function toFeatureCollection(vehicles, selected) {
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
          selected: vehicle.id === selected ? 1 : 0
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
  let clickBound = false;

  const ready = (async () => {
    for (const [type, url] of Object.entries(ASSETS)) {
      const id = iconId(type);
      if (map.hasImage(id)) continue;
      try {
        const image = await loadImage(map, url);
        if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: 2 });
      } catch (error) {
        console.warn("Nako vehicle icon failed to load", type, error);
      }
    }

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: toFeatureCollection(vehicles, selected)
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
    if (source) source.setData(toFeatureCollection(vehicles, selected));
  }

  return {
    async setVehicles(next) {
      vehicles = next || [];
      await ready;
      sync();
    },
    async setSelected(id) {
      selected = id;
      await ready;
      sync();
    },
    clear() {
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
