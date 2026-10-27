const MATERIALS = new Map();

function material(THREE, color, extras = {}) {
  const key = `${color}-${extras.basic ? "b" : "s"}-${extras.opacity || 1}`;
  if (!MATERIALS.has(key)) {
    MATERIALS.set(key, extras.basic
      ? new THREE.MeshBasicMaterial({ color, transparent: extras.opacity < 1, opacity: extras.opacity ?? 1, depthWrite: extras.depthWrite !== false })
      : new THREE.MeshStandardMaterial({ color, roughness: extras.roughness ?? 0.48, metalness: extras.metalness ?? 0.08 }));
  }
  return MATERIALS.get(key);
}

function box(THREE, w, h, d, x, y, z, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  return mesh;
}

function wheel(THREE, x, z, radius) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.22, 16), material(THREE, 0x1c1c1c, { roughness: 0.7 }));
  mesh.rotation.z = Math.PI / 2;
  mesh.position.set(x, radius, z);
  mesh.name = "wheel";
  return mesh;
}

function shadow(THREE, radius) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 28),
    material(THREE, 0x102033, { basic: true, opacity: 0.28, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  mesh.name = "shadow";
  return mesh;
}

function ring(THREE) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(2.5, 3.15, 40),
    material(THREE, 0x4ea1ff, { basic: true, opacity: 0.95 })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.05;
  mesh.name = "ring";
  mesh.visible = false;
  return mesh;
}

function paint(type, index) {
  if (type === "bus") return { body: 0xf4f7fb, accent: 0x1f6feb, roof: 0xe8eef6, glass: 0x16324f };
  if (type === "taxi") {
    const bodies = [0xf8fafc, 0xf5f1e6, 0xe8eef8];
    return { body: bodies[index % bodies.length], accent: 0xf5c542, roof: 0x111827, glass: 0x1d3c5a };
  }
  const accents = [0x127a3a, 0x1f6feb, 0xc2410c];
  return { body: 0xf6f8fb, accent: accents[index % accents.length], roof: accents[index % accents.length], glass: 0x1a334c };
}

function buildTaxi(THREE, colors) {
  const group = new THREE.Group();
  group.add(shadow(THREE, 2.6));
  group.add(ring(THREE));
  const bodyMat = material(THREE, colors.body);
  const glassMat = material(THREE, colors.glass, { roughness: 0.18, metalness: 0.25 });
  const lampMat = material(THREE, colors.accent, { basic: true });
  // Compact sedan silhouette
  group.add(box(THREE, 1.85, 0.55, 4.4, 0, 0.7, 0, bodyMat));
  group.add(box(THREE, 1.7, 0.55, 2.2, 0, 1.22, -0.15, bodyMat));
  group.add(box(THREE, 1.55, 0.4, 1.95, 0, 1.3, -0.15, glassMat));
  // Yellow taxi roof sign
  group.add(box(THREE, 0.55, 0.22, 0.85, 0, 1.72, -0.1, lampMat));
  group.add(wheel(THREE, -0.82, -1.35, 0.34));
  group.add(wheel(THREE, 0.82, -1.35, 0.34));
  group.add(wheel(THREE, -0.82, 1.3, 0.34));
  group.add(wheel(THREE, 0.82, 1.3, 0.34));
  const lamp = material(THREE, 0xffe7a3, { basic: true });
  group.add(box(THREE, 0.18, 0.12, 0.08, -0.6, 0.72, 2.2, lamp));
  group.add(box(THREE, 0.18, 0.12, 0.08, 0.6, 0.72, 2.2, lamp));
  return group;
}

function buildKombi(THREE, colors) {
  const group = new THREE.Group();
  group.add(shadow(THREE, 3.2));
  group.add(ring(THREE));
  const bodyMat = material(THREE, colors.body);
  const accentMat = material(THREE, colors.accent);
  const glassMat = material(THREE, colors.glass, { roughness: 0.18, metalness: 0.25 });
  // Tall boxy minibus
  group.add(box(THREE, 2.05, 1.7, 5.1, 0, 1.2, 0, bodyMat));
  group.add(box(THREE, 2.08, 0.28, 5.05, 0, 2.12, 0, accentMat));
  group.add(box(THREE, 1.8, 0.7, 2.7, 0, 1.55, -0.2, glassMat));
  group.add(box(THREE, 1.65, 0.55, 0.75, 0, 1.45, 2.05, glassMat));
  group.add(wheel(THREE, -0.9, -1.55, 0.38));
  group.add(wheel(THREE, 0.9, -1.55, 0.38));
  group.add(wheel(THREE, -0.9, 1.5, 0.38));
  group.add(wheel(THREE, 0.9, 1.5, 0.38));
  const lamp = material(THREE, 0xffe7a3, { basic: true });
  group.add(box(THREE, 0.2, 0.14, 0.08, -0.65, 0.85, 2.55, lamp));
  group.add(box(THREE, 0.2, 0.14, 0.08, 0.65, 0.85, 2.55, lamp));
  return group;
}

function buildBus(THREE, colors) {
  const group = new THREE.Group();
  group.add(shadow(THREE, 6.4));
  group.add(ring(THREE));
  const bodyMat = material(THREE, colors.body);
  const accentMat = material(THREE, colors.accent);
  const roofMat = material(THREE, colors.roof);
  const glassMat = material(THREE, colors.glass, { roughness: 0.18, metalness: 0.25 });
  // Long coach
  group.add(box(THREE, 2.6, 1.85, 11.6, 0, 1.55, 0, bodyMat));
  group.add(box(THREE, 2.65, 0.45, 11.6, 0, 0.75, 0, accentMat));
  group.add(box(THREE, 2.55, 0.2, 11.4, 0, 2.55, 0, roofMat));
  group.add(box(THREE, 2.3, 0.85, 8.2, 0, 1.85, -0.3, glassMat));
  group.add(box(THREE, 2.1, 0.7, 0.9, 0, 1.7, 5.2, glassMat));
  group.add(wheel(THREE, -1.2, -3.5, 0.5));
  group.add(wheel(THREE, 1.2, -3.5, 0.5));
  group.add(wheel(THREE, -1.2, 1.2, 0.5));
  group.add(wheel(THREE, 1.2, 1.2, 0.5));
  group.add(wheel(THREE, -1.2, 3.6, 0.5));
  group.add(wheel(THREE, 1.2, 3.6, 0.5));
  const lamp = material(THREE, 0xffe7a3, { basic: true });
  group.add(box(THREE, 0.22, 0.14, 0.1, -0.85, 1.05, 5.8, lamp));
  group.add(box(THREE, 0.22, 0.14, 0.1, 0.85, 1.05, 5.8, lamp));
  return group;
}

export function buildVehicle(THREE, type, index) {
  const colors = paint(type, index);
  const group = type === "taxi"
    ? buildTaxi(THREE, colors)
    : type === "bus"
      ? buildBus(THREE, colors)
      : buildKombi(THREE, colors);
  group.userData.type = type;
  group.traverse((obj) => {
    obj.frustumCulled = false;
  });
  return group;
}
