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
    material(THREE, 0x102033, { basic: true, opacity: 0.22, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  mesh.name = "shadow";
  return mesh;
}

function ring(THREE) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(2.5, 3.15, 40),
    material(THREE, 0x1f6feb, { basic: true, opacity: 0.95 })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.05;
  mesh.name = "ring";
  mesh.visible = false;
  return mesh;
}

function paint(type, index) {
  if (type === "bus") return { body: 0xf7f9fc, skirt: 0x1f6feb, glass: 0x16324f };
  if (type === "taxi") {
    const bodies = [0xf8fafc, 0xf3f0e6, 0xe7eef8];
    return { body: bodies[index % bodies.length], skirt: 0xd7dde6, glass: 0x1d3c5a, lamp: 0xf5c542 };
  }
  const stripes = [0x1f6feb, 0x127a3a, 0x111827];
  return { body: 0xf6f8fb, skirt: stripes[index % stripes.length], glass: 0x1a334c };
}

export function buildVehicle(THREE, type, index) {
  const group = new THREE.Group();
  const colors = paint(type, index);
  group.add(shadow(THREE, type === "bus" ? 6.2 : 3.1));
  group.add(ring(THREE));
  const bodyMat = material(THREE, colors.body);
  const skirtMat = material(THREE, colors.skirt);
  const glassMat = material(THREE, colors.glass, { roughness: 0.18, metalness: 0.25 });

  if (type === "bus") {
    group.add(box(THREE, 2.5, 1.5, 11.2, 0, 1.55, 0, bodyMat));
    group.add(box(THREE, 2.55, 0.7, 11.2, 0, 0.85, 0, skirtMat));
    group.add(box(THREE, 2.2, 0.7, 7.4, 0, 2.15, -0.4, glassMat));
    group.add(wheel(THREE, -1.15, -3.3, 0.48));
    group.add(wheel(THREE, 1.15, -3.3, 0.48));
    group.add(wheel(THREE, -1.15, 3.1, 0.48));
    group.add(wheel(THREE, 1.15, 3.1, 0.48));
  } else if (type === "taxi") {
    group.add(box(THREE, 1.75, 0.62, 4.35, 0, 0.72, 0, bodyMat));
    group.add(box(THREE, 1.62, 0.58, 2.15, 0, 1.25, -0.25, bodyMat));
    group.add(box(THREE, 1.45, 0.42, 1.9, 0, 1.32, -0.25, glassMat));
    group.add(box(THREE, 0.34, 0.16, 0.34, 0, 1.62, -0.25, material(THREE, colors.lamp, { basic: true })));
    group.add(wheel(THREE, -0.78, -1.35, 0.32));
    group.add(wheel(THREE, 0.78, -1.35, 0.32));
    group.add(wheel(THREE, -0.78, 1.25, 0.32));
    group.add(wheel(THREE, 0.78, 1.25, 0.32));
  } else {
    group.add(box(THREE, 1.95, 1.55, 4.7, 0, 1.15, 0, bodyMat));
    group.add(box(THREE, 1.95, 0.42, 4.5, 0, 1.95, 0, skirtMat));
    group.add(box(THREE, 1.7, 0.62, 2.5, 0, 1.55, -0.15, glassMat));
    group.add(box(THREE, 1.55, 0.5, 0.7, 0, 1.48, 1.85, glassMat));
    group.add(wheel(THREE, -0.85, -1.45, 0.34));
    group.add(wheel(THREE, 0.85, -1.45, 0.34));
    group.add(wheel(THREE, -0.85, 1.35, 0.34));
    group.add(wheel(THREE, 0.85, 1.35, 0.34));
  }

  const lamp = material(THREE, 0xffe7a3, { basic: true });
  const nose = type === "bus" ? 5.55 : type === "taxi" ? 2.15 : 2.32;
  const lampY = type === "bus" ? 1.05 : 0.78;
  const lampX = type === "bus" ? 0.7 : 0.55;
  group.add(box(THREE, 0.18, 0.12, 0.08, -lampX, lampY, nose, lamp));
  group.add(box(THREE, 0.18, 0.12, 0.08, lampX, lampY, nose, lamp));
  group.traverse((obj) => {
    obj.frustumCulled = false;
  });
  return group;
}
