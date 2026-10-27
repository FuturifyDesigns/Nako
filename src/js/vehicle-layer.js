const ASSETS = {
  taxi: "../assets/vehicles/taxi-mark.png",
  kombi: "../assets/vehicles/kombi-mark.png",
  bus: "../assets/vehicles/bus-mark.png"
};

const SIZES = {
  taxi: 40,
  kombi: 46,
  bus: 52
};

function assetFor(type) {
  if (type === "taxi") return ASSETS.taxi;
  if (type === "bus") return ASSETS.bus;
  return ASSETS.kombi;
}

function sizeFor(type) {
  if (type === "taxi") return SIZES.taxi;
  if (type === "bus") return SIZES.bus;
  return SIZES.kombi;
}

function makeEl(vehicle, selected) {
  const type = vehicle.type === "taxi" || vehicle.type === "bus" ? vehicle.type : "kombi";
  const width = sizeFor(type);
  const wrap = document.createElement("button");
  wrap.type = "button";
  wrap.className = `vehicle-marker${selected ? " is-selected" : ""}`;
  wrap.dataset.id = vehicle.id;
  wrap.dataset.type = type;
  wrap.setAttribute("aria-label", `${type} ${vehicle.plate || ""}`.trim());
  wrap.style.width = `${width}px`;
  const img = document.createElement("img");
  img.src = `${assetFor(type)}?v=3`;
  img.alt = "";
  img.draggable = false;
  img.width = width;
  img.height = Math.round(width * 0.66);
  wrap.append(img);
  return wrap;
}

export function createVehicleLayer(map, maplibregl, { onSelect } = {}) {
  const markers = new Map();
  let selected = null;
  let vehicles = [];

  function sync() {
    const seen = new Set();
    vehicles.forEach((vehicle) => {
      const type = vehicle.type === "taxi" || vehicle.type === "bus" ? vehicle.type : "kombi";
      seen.add(vehicle.id);
      let entry = markers.get(vehicle.id);
      if (!entry || entry.type !== type) {
        entry?.marker.remove();
        const el = makeEl(vehicle, vehicle.id === selected);
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          onSelect?.(vehicle);
        });
        // Anchor dead-center on geo coords so zoom never drifts the marker.
        const marker = new maplibregl.Marker({
          element: el,
          anchor: "center",
          offset: [0, 0],
          pitchAlignment: "map",
          rotationAlignment: "map"
        })
          .setLngLat([vehicle.lng, vehicle.lat])
          .addTo(map);
        entry = { marker, el, type };
        markers.set(vehicle.id, entry);
      } else {
        entry.marker.setLngLat([vehicle.lng, vehicle.lat]);
        entry.el.classList.toggle("is-selected", vehicle.id === selected);
      }
    });
    for (const [id, entry] of markers) {
      if (!seen.has(id)) {
        entry.marker.remove();
        markers.delete(id);
      }
    }
  }

  return {
    setVehicles(next) {
      vehicles = next || [];
      sync();
    },
    setSelected(id) {
      selected = id;
      for (const [vid, entry] of markers) {
        entry.el.classList.toggle("is-selected", vid === selected);
      }
    },
    clear() {
      for (const [, entry] of markers) entry.marker.remove();
      markers.clear();
      vehicles = [];
      selected = null;
    }
  };
}
