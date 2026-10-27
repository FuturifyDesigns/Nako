import * as THREE from "../../vendor/three.module.js";
import { buildVehicle } from "./models.js";

function modelMatrix(maplibregl, vehicle) {
  const merc = maplibregl.MercatorCoordinate.fromLngLat([vehicle.lng, vehicle.lat], 0);
  const scale = merc.meterInMercatorCoordinateUnits() * 22;
  const rotationX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const rotationY = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 1, 0), -THREE.MathUtils.degToRad(vehicle.bearing || 0));
  return new THREE.Matrix4()
    .makeTranslation(merc.x, merc.y, merc.z)
    .scale(new THREE.Vector3(scale, -scale, scale))
    .multiply(rotationX)
    .multiply(rotationY);
}

function disposeMesh(mesh) {
  mesh.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
  });
}

export function createVehicleLayer(maplibregl) {
  const layer = {
    id: "nako-vehicles",
    type: "custom",
    renderingMode: "3d",
    _vehicles: [],
    _selected: null,
    _meshes: new Map(),
    onAdd(map, gl) {
      this.map = map;
      this.camera = new THREE.Camera();
      this.scene = new THREE.Scene();
      const lightA = new THREE.DirectionalLight(0xffffff, 1.2);
      lightA.position.set(40, 80, 20);
      const lightB = new THREE.DirectionalLight(0xa8c4ff, 0.5);
      lightB.position.set(-30, 40, -20);
      this.scene.add(lightA, lightB, new THREE.AmbientLight(0xffffff, 0.7));
      this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      this.renderer.autoClear = false;
    },
    setVehicles(vehicles) {
      this._vehicles = vehicles || [];
      this.map?.triggerRepaint();
    },
    setSelected(id) {
      this._selected = id;
      this.map?.triggerRepaint();
    },
    clear() {
      for (const [, mesh] of this._meshes) {
        this.scene?.remove(mesh);
        disposeMesh(mesh);
      }
      this._meshes.clear();
      this._vehicles = [];
    },
    render(_gl, args) {
      if (!this.renderer || !this.map) return;
      const matrix = args?.defaultProjectionData?.mainMatrix || args;
      if (!matrix || typeof matrix.length !== "number") return;
      const seen = new Set();
      this._vehicles.forEach((vehicle, index) => {
        const type = vehicle.type === "taxi" || vehicle.type === "bus" ? vehicle.type : "kombi";
        seen.add(vehicle.id);
        let mesh = this._meshes.get(vehicle.id);
        if (!mesh || mesh.userData.type !== type) {
          if (mesh) {
            this.scene.remove(mesh);
            disposeMesh(mesh);
          }
          mesh = buildVehicle(THREE, type, index);
          mesh.userData.type = type;
          this.scene.add(mesh);
          this._meshes.set(vehicle.id, mesh);
        }
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(modelMatrix(maplibregl, vehicle));
        mesh.matrixWorldNeedsUpdate = true;
        mesh.updateMatrixWorld(true);
        const marker = mesh.getObjectByName("ring");
        if (marker) marker.visible = vehicle.id === this._selected;
      });
      for (const [id, mesh] of this._meshes) {
        if (!seen.has(id)) {
          this.scene.remove(mesh);
          disposeMesh(mesh);
          this._meshes.delete(id);
        }
      }
      this.camera.projectionMatrix.fromArray(matrix);
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
    }
  };
  return layer;
}
