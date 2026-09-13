import * as THREE from "../../three.module.js";
import { createRandom, randomBetween, seedFromString } from "../core/random.js";

const material = (color, roughness = 0.88) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

function place(object, x, z, heightAt, lift = 0) {
  object.position.set(x, heightAt(x, z) + lift, z);
  return object;
}

function ellipseWater(location, heightAt, x, z, rx, rz, rotation = 0) {
  const geometry = new THREE.CircleGeometry(1, 72);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: location.palette.water,
    roughness: 0.18,
    metalness: 0.08,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
  }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = rotation;
  mesh.scale.set(rx, rz, 1);
  place(mesh, x, z, heightAt, 0.7);
  mesh.receiveShadow = true;
  mesh.userData.water = true;
  return mesh;
}

function rock(location, radius, height, sides = 9, color = location.palette.rock) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, sides), material(color));
  mesh.geometry.translate(0, height / 2, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function layeredButte(location, scale = 1, chalk = false) {
  const group = new THREE.Group();
  const colors = chalk
    ? [0xded9c8, 0xcfc6ad, 0xe9e5d8, 0xbeb49c]
    : [0xb87048, 0x9c5839, 0xce8a5d, 0x864831];
  for (let index = 0; index < 5; index += 1) {
    const radius = (8.5 - index * 1.1) * scale;
    const height = (5.2 + index * 0.15) * scale;
    const layer = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.86, radius, height, 9), material(colors[index % colors.length]));
    layer.position.y = (index + 0.5) * 4.5 * scale;
    layer.rotation.y = index * 0.23;
    layer.castShadow = true;
    group.add(layer);
  }
  return group;
}

function erodedMesa(location, random, scale = 1, chalk = false) {
  const colors = chalk
    ? [0xb9b099, 0xd7d0bd, 0xc7bea7, 0xe8e3d4, 0xf0ecdf]
    : [0x884a35, 0xa45c3d, 0xc7774d, 0x985038, 0xd28a5d];
  const segments = 22;
  const levels = [0, .11, .27, .48, .7, .86, 1];
  const radii = [1.34, 1.2, 1.07, 1.02, .94, .88, .86];
  const vertices = [];
  const vertexColors = [];
  const indices = [];
  const phase = random() * Math.PI * 2;
  const dents = Array.from({ length: segments }, (_, index) =>
    1 + Math.sin(index * 2.3 + phase) * .07 + Math.sin(index * .71 - phase) * .1 + randomBetween(random, -.045, .045));
  for (let level = 0; level < levels.length; level += 1) {
    const colorIndex = Math.min(colors.length - 1, Math.floor(level / levels.length * colors.length));
    const tint = new THREE.Color(colors[colorIndex]);
    const shiftX = Math.sin(level * 1.9 + phase) * .065;
    const shiftZ = Math.cos(level * 1.3 - phase) * .05;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = segment / segments * Math.PI * 2;
      const radius = radii[level] * dents[segment];
      vertices.push(
        (Math.cos(angle) * radius + shiftX) * 18 * scale,
        levels[level] * 42 * scale,
        (Math.sin(angle) * radius + shiftZ) * 13 * scale,
      );
      vertexColors.push(tint.r, tint.g, tint.b);
      if (level < levels.length - 1) {
        const a = level * segments + segment;
        const b = level * segments + (segment + 1) % segments;
        const c = (level + 1) * segments + segment;
        const d = (level + 1) * segments + (segment + 1) % segments;
        indices.push(a, c, b, b, c, d);
      }
    }
  }
  const topCenter = vertices.length / 3;
  vertices.push(0, 42 * scale, 0);
  const topTint = new THREE.Color(colors[colors.length - 1]);
  vertexColors.push(topTint.r, topTint.g, topTint.b);
  const topStart = (levels.length - 1) * segments;
  for (let segment = 0; segment < segments; segment += 1) {
    indices.push(topCenter, topStart + segment, topStart + (segment + 1) % segments);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(vertexColors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesa = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .94, flatShading: true }));
  mesa.castShadow = true;
  mesa.receiveShadow = true;
  return mesa;
}

function makeYurt(scale = 1) {
  const group = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.75, 2.5, 24), material(0xe3dbc8));
  wall.position.y = 1.25;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.75, 1.8, 24), material(0xd7cdb8));
  roof.position.y = 3.4;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.72, 0.34, 16), material(0x9e5538));
  crown.position.y = 4.35;
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.9, 0.18), material(0x8a4933));
  door.position.set(0, 1.15, 3.67);
  const band = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.1, 6, 32), material(0xa9603e));
  band.rotation.x = Math.PI / 2;
  band.position.y = 2.05;
  group.add(wall, roof, crown, door, band);
  group.scale.setScalar(scale);
  group.traverse((child) => { if (child.isMesh) child.castShadow = true; });
  return group;
}

function makeObservatory() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 4.6, 24), material(0xd5d9d8));
  base.position.y = 2.3;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4.25, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), material(0xe5e9e8, 0.45));
  dome.position.y = 4.6;
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.65, 3.4, 4.3), material(0x657176, 0.45));
  slit.position.set(0, 6.2, 1.6);
  group.add(base, dome, slit);
  group.traverse((child) => { if (child.isMesh) child.castShadow = true; });
  return group;
}

function makeDeadTree(random, height = 10) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.23, height, 7), material(0xb8ad99));
  trunk.position.y = height / 2;
  group.add(trunk);
  for (let index = 0; index < 4; index += 1) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.085, height * 0.28, 5), material(0xaaa08f));
    branch.position.set(0, height * randomBetween(random, 0.45, 0.78), 0);
    branch.rotation.z = randomBetween(random, -1.1, 1.1);
    branch.rotation.y = random() * Math.PI * 2;
    group.add(branch);
  }
  return group;
}

function waterRibbon(location, heightAt, offset = 0, width = 22) {
  const points = 38;
  const vertices = [];
  const indices = [];
  for (let index = 0; index < points; index += 1) {
    const z = -820 + index / (points - 1) * 1640;
    const x = Math.sin(z * 0.008 + offset) * 95 + Math.sin(z * 0.021) * 22 + offset * 34;
    const nextZ = z + 1;
    const nextX = Math.sin(nextZ * 0.008 + offset) * 95 + Math.sin(nextZ * 0.021) * 22 + offset * 34;
    const angle = Math.atan2(nextZ - z, nextX - x);
    const nx = Math.sin(angle) * width;
    const nz = -Math.cos(angle) * width;
    const y = heightAt(x, z) + 0.8;
    vertices.push(x + nx, y, z + nz, x - nx, y, z - nz);
    if (index < points - 1) {
      const a = index * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: location.palette.water, roughness: 0.2, transparent: true, opacity: 0.86, side: THREE.DoubleSide }));
  mesh.userData.water = true;
  return mesh;
}

function addMountainWall(group, location, heightAt, random, { snow = false, chalk = false } = {}) {
  for (let index = 0; index < 14; index += 1) {
    const angle = index / 14 * Math.PI * 2 + randomBetween(random, -0.12, 0.12);
    const distance = randomBetween(random, 660, 830);
    const height = randomBetween(random, 70, 180);
    const radius = randomBetween(random, 45, 110);
    let peak;
    if (chalk) {
      peak = erodedMesa(location, random, randomBetween(random, 2.3, 4.2), true);
      peak.scale.set(randomBetween(random, 1.4, 2.8), randomBetween(random, .75, 1.45), randomBetween(random, .7, 1.25));
    } else {
      peak = rock(location, radius, height, 7, location.palette.rock);
    }
    place(peak, Math.sin(angle) * distance, Math.cos(angle) * distance, heightAt, -3);
    peak.rotation.y = random() * Math.PI;
    group.add(peak);
    if (!chalk && snow && height > 118) {
      const cap = rock(location, radius * 0.43, height * 0.3, 7, 0xe8ece9);
      cap.position.set(peak.position.x, peak.position.y + height * 0.69, peak.position.z);
      cap.rotation.y = peak.rotation.y;
      group.add(cap);
    }
  }
}

function addGraniteCluster(group, location, heightAt, random, centerX, centerZ, count, scale = 1) {
  for (let index = 0; index < count; index += 1) {
    const radius = randomBetween(random, 3, 11) * scale;
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 1), material(location.palette.rock));
    mesh.scale.set(randomBetween(random, .7, 1.25), randomBetween(random, .75, 1.6), randomBetween(random, .7, 1.3));
    mesh.rotation.set(random() * .6, random() * Math.PI, random() * .6);
    place(mesh, centerX + randomBetween(random, -26, 26), centerZ + randomBetween(random, -26, 26), heightAt, radius * .25);
    mesh.castShadow = true;
    group.add(mesh);
  }
}

export function createLandmarks(location, heightAt) {
  const group = new THREE.Group();
  group.name = `landmarks:${location.landmark}`;
  const random = createRandom(seedFromString(`${location.id}:landmarks`));

  if (location.landmark === "graniteRidges") {
    addGraniteCluster(group, location, heightAt, random, 260, 150, 18, 1.2);
    addGraniteCluster(group, location, heightAt, random, -340, -220, 11, .8);
  }
  if (location.landmark === "okzhetpes") {
    group.add(ellipseWater(location, heightAt, 260, 120, 190, 120, .2));
    addGraniteCluster(group, location, heightAt, random, 330, 90, 22, 1.45);
    const needle = rock(location, 11, 58, 8);
    needle.scale.x = .7;
    group.add(place(needle, 342, 84, heightAt));
  }
  if (location.landmark === "weatheredGranite") {
    group.add(ellipseWater(location, heightAt, -250, 180, 155, 92, -.3));
    addGraniteCluster(group, location, heightAt, random, 250, -120, 26, 1.2);
  }
  if (location.landmark === "wetlandPools") {
    for (let index = 0; index < 12; index += 1) {
      group.add(ellipseWater(location, heightAt, randomBetween(random, -650, 650), randomBetween(random, -650, 650), randomBetween(random, 35, 130), randomBetween(random, 18, 68), random() * Math.PI));
    }
  }
  if (location.landmark === "snowPeaks") addMountainWall(group, location, heightAt, random, { snow: true });
  if (location.landmark === "observatory") {
    group.add(place(makeObservatory(), 270, 180, heightAt));
    group.add(place(makeYurt(.8), 220, 215, heightAt));
    addMountainWall(group, location, heightAt, random, { snow: true });
  }
  if (location.landmark === "threeLakes") {
    group.add(ellipseWater(location, heightAt, 240, 120, 145, 54, .65));
    group.add(ellipseWater(location, heightAt, -250, -80, 115, 46, -.4));
    group.add(ellipseWater(location, heightAt, 80, -430, 86, 38, .25));
    addMountainWall(group, location, heightAt, random, { snow: true });
  }
  if (location.landmark === "sunkenForest") {
    group.add(ellipseWater(location, heightAt, 260, 170, 180, 74, .55));
    for (let index = 0; index < 34; index += 1) {
      const x = 260 + randomBetween(random, -145, 145);
      const z = 170 + randomBetween(random, -48, 48);
      group.add(place(makeDeadTree(random, randomBetween(random, 7, 15)), x, z, heightAt, .9));
    }
    addMountainWall(group, location, heightAt, random, { snow: false });
  }
  if (location.landmark === "castleValley") {
    for (let index = 0; index < 30; index += 1) {
      const side = index % 2 ? 1 : -1;
      const x = side * randomBetween(random, 120, 300);
      const z = randomBetween(random, -720, 720);
      const tower = layeredButte(location, randomBetween(random, .55, 1.15));
      tower.scale.x = randomBetween(random, .55, 1.1);
      group.add(place(tower, x, z, heightAt));
    }
  }
  if (location.landmark === "singingDune") {
    for (let index = 0; index < 5; index += 1) {
      const dune = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2), material(0xd4ad70));
      dune.scale.set(150 - index * 18, 28 - index * 2, 46 + index * 7);
      place(dune, 270 + index * 45, 210 + index * 25, heightAt, -5);
      dune.rotation.y = -.45;
      group.add(dune);
    }
    for (let index = 0; index < 8; index += 1) {
      const aktau = layeredButte(location, randomBetween(random, 1.1, 2));
      aktau.children.forEach((layer, layerIndex) => layer.material = material([0xe2c59b, 0xca8e68, 0xe4ddd0, 0xaa6954][layerIndex % 4]));
      group.add(place(aktau, -520 + index * 120, -580 + randomBetween(random, -50, 50), heightAt));
    }
  }
  if (location.landmark === "braidedRiver") {
    group.add(waterRibbon(location, heightAt, -.8, 16));
    group.add(waterRibbon(location, heightAt, .7, 11));
    group.add(waterRibbon(location, heightAt, 1.7, 7));
  }
  if (location.landmark === "balkhashShore") {
    const sea = ellipseWater(location, heightAt, 560, 250, 690, 760, -.2);
    sea.position.y = heightAt(180, 100) + .5;
    group.add(sea);
    for (let index = 0; index < 10; index += 1) addGraniteCluster(group, location, heightAt, random, 10 + index * 45, -430 + index * 80, 3, .45);
  }
  if (location.landmark === "altaiGlacier") addMountainWall(group, location, heightAt, random, { snow: true });
  if (location.landmark === "chink") {
    for (let index = 0; index < 14; index += 1) {
      const butte = layeredButte(location, randomBetween(random, 1.3, 2.3), true);
      butte.scale.x = randomBetween(random, 1.2, 2.4);
      group.add(place(butte, -670 + index * 100, 420 + Math.sin(index * .8) * 100, heightAt));
    }
  }
  if (location.landmark === "bozzhyraFangs") {
    addMountainWall(group, location, heightAt, random, { chalk: true });
    for (const [x, z, scale] of [[260, 180, 1.2], [300, 205, .95]]) {
      const fang = rock(location, 13 * scale, 96 * scale, 7, 0xe8e3d5);
      fang.scale.x = .58;
      group.add(place(fang, x, z, heightAt));
    }
    for (let index = 0; index < 8; index += 1) {
      const mesa = erodedMesa(location, random, randomBetween(random, 1.15, 2.05), true);
      mesa.scale.x = randomBetween(random, 1.25, 2.4);
      group.add(place(mesa, randomBetween(random, -700, 700), randomBetween(random, -700, 700), heightAt));
    }
  }

  if (["saryarka", "assy", "ili"].includes(location.id)) {
    group.add(place(makeYurt(1), -22, 18, heightAt));
    group.add(place(makeYurt(.74), 18, 26, heightAt));
  }
  return group;
}
