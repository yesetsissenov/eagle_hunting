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

function mountainPeak(location, random, radius, height, color = location.palette.rock) {
  const segments = 18;
  const levels = [0, .2, .43, .64, .81, .93, 1];
  const vertices = [];
  const colors = [];
  const indices = [];
  const tint = new THREE.Color(color);
  if (["alpine", "alpineLake", "altai", "lakeGranite"].includes(location.terrain)) tint.lerp(new THREE.Color(0x9aa49b), .22);
  const profile = Array.from({ length: segments }, (_, index) => 1 + Math.sin(index * 2.17 + random() * .25) * .12 + randomBetween(random, -.08, .08));
  let driftX = 0;
  let driftZ = 0;
  for (let level = 0; level < levels.length; level += 1) {
    const t = levels[level];
    const ringRadius = (1 - t) ** .72;
    driftX += randomBetween(random, -.035, .035) * radius;
    driftZ += randomBetween(random, -.03, .03) * radius;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = segment / segments * Math.PI * 2;
      const crag = profile[segment] * (1 + Math.sin(segment * 3.1 + level) * .035);
      vertices.push(Math.cos(angle) * radius * ringRadius * crag + driftX, t * height, Math.sin(angle) * radius * ringRadius * crag + driftZ);
      const shade = tint.clone().offsetHSL(0, 0, (t - .45) * .11 + Math.sin(angle) * .035);
      colors.push(shade.r, shade.g, shade.b);
      if (level < levels.length - 1) {
        const a = level * segments + segment;
        const b = level * segments + (segment + 1) % segments;
        const c = (level + 1) * segments + segment;
        const d = (level + 1) * segments + (segment + 1) % segments;
        indices.push(a, c, b, b, c, d);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const peak = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .97, flatShading: true }));
  peak.castShadow = true;
  peak.receiveShadow = true;
  return peak;
}

function ribbonMesh(location, heightAt, { width, color, opacity = 1, offset = 0, phase = 0, lift = .32, points = 72 }) {
  const vertices = [];
  const indices = [];
  for (let index = 0; index < points; index += 1) {
    const z = -860 + index / (points - 1) * 1720;
    const x = offset + Math.sin(z * .0048 + phase) * 82 + Math.sin(z * .013 - phase) * 18;
    const nextZ = z + 1;
    const nextX = offset + Math.sin(nextZ * .0048 + phase) * 82 + Math.sin(nextZ * .013 - phase) * 18;
    const length = Math.hypot(nextX - x, nextZ - z) || 1;
    const nx = (nextZ - z) / length * width;
    const nz = -(nextX - x) / length * width;
    vertices.push(x + nx, heightAt(x + nx, z + nz) + lift, z + nz, x - nx, heightAt(x - nx, z - nz) + lift, z - nz);
    if (index < points - 1) {
      const a = index * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: opacity < 1, opacity, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 }));
  mesh.receiveShadow = true;
  return mesh;
}

function addRoad(group, location, heightAt) {
  const wilderness = ["alpine", "alpineLake", "altai", "chalkPlateau"].includes(location.terrain);
  const dry = ["desert", "canyon", "chalkPlateau", "shore"].includes(location.terrain);
  const phase = (location.id.length * .73) % Math.PI;
  const offset = location.landmark === "castleValley" ? -20 : location.landmark === "singingDune" ? -115 : 22;
  const width = wilderness ? 3.4 : 6.2;
  group.add(ribbonMesh(location, heightAt, { width, color: dry ? 0x96714f : 0x806b4c, opacity: .94, offset, phase, lift: .28 }));
  if (!wilderness) {
    group.add(ribbonMesh(location, heightAt, { width: .46, color: 0x554535, opacity: .72, offset: offset - width * .52, phase, lift: .36 }));
    group.add(ribbonMesh(location, heightAt, { width: .46, color: 0x554535, opacity: .72, offset: offset + width * .52, phase, lift: .36 }));
  }
}

function addCliffCorridor(group, location, heightAt, random, { chalk = false, oneSided = false } = {}) {
  const colors = chalk ? [0xd8d1bd, 0xbeb49d, 0xeee9da] : [0x87472f, 0xa95d3c, 0xc27a50];
  const sides = oneSided ? [1] : [-1, 1];
  for (const side of sides) {
    for (let band = 0; band < 3; band += 1) {
      const vertices = [];
      const indices = [];
      const points = 58;
      for (let index = 0; index < points; index += 1) {
        const z = -830 + index / (points - 1) * 1660;
        const center = Math.sin(z * .0065) * (oneSided ? 72 : 48) + Math.sin(z * .017) * 15;
        const x = center + side * (oneSided ? 330 + band * 34 : 95 + band * 34) + Math.sin(index * .77 + band) * 6;
        const base = heightAt(x, z) - 5 + band * 9;
        const height = (oneSided ? 58 : 34) - band * 7 + Math.sin(index * .63 + band) * 7;
        vertices.push(x, base, z, x + side * (20 + band * 5), base + height, z);
        if (index < points - 1) {
          const a = index * 2;
          indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const wall = new THREE.Mesh(geometry, material(colors[band]));
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);
    }
    for (let index = 0; index < 18; index += 1) {
      const z = randomBetween(random, -780, 780);
      const center = Math.sin(z * .0065) * (oneSided ? 72 : 48) + Math.sin(z * .017) * 15;
      const peak = mountainPeak(location, random, randomBetween(random, 12, 27), randomBetween(random, 38, 92), colors[index % colors.length]);
      place(peak, center + side * (oneSided ? randomBetween(random, 315, 395) : randomBetween(random, 118, 180)), z, heightAt, -3);
      group.add(peak);
    }
  }
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
  for (let index = 0; index < 21; index += 1) {
    const angle = index / 21 * Math.PI * 2 + randomBetween(random, -.1, .1);
    const distance = randomBetween(random, 480, 820);
    const height = randomBetween(random, 105, 245);
    const radius = randomBetween(random, 70, 155);
    let peak;
    if (chalk) {
      peak = erodedMesa(location, random, randomBetween(random, 2.3, 4.2), true);
      peak.scale.set(randomBetween(random, 1.4, 2.8), randomBetween(random, .75, 1.45), randomBetween(random, .7, 1.25));
    } else {
      peak = mountainPeak(location, random, radius, height, location.palette.rock);
    }
    place(peak, Math.sin(angle) * distance, Math.cos(angle) * distance, heightAt, -3);
    peak.rotation.y = random() * Math.PI;
    group.add(peak);
    if (!chalk && snow && height > 145) {
      const cap = mountainPeak(location, random, radius * .34, height * .24, 0xe8ece9);
      cap.position.set(peak.position.x, peak.position.y + height * .74, peak.position.z);
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
    group.add(ellipseWater(location, heightAt, 95, 145, 225, 82, .28));
    group.add(ellipseWater(location, heightAt, -250, -80, 115, 46, -.4));
    group.add(ellipseWater(location, heightAt, 80, -430, 86, 38, .25));
    addMountainWall(group, location, heightAt, random, { snow: true });
  }
  if (location.landmark === "sunkenForest") {
    group.add(ellipseWater(location, heightAt, 95, 155, 220, 88, .3));
    for (let index = 0; index < 34; index += 1) {
      const x = 95 + randomBetween(random, -180, 180);
      const z = 155 + randomBetween(random, -62, 62);
      group.add(place(makeDeadTree(random, randomBetween(random, 7, 15)), x, z, heightAt, .9));
    }
    addMountainWall(group, location, heightAt, random, { snow: false });
  }
  if (location.landmark === "castleValley") {
    addCliffCorridor(group, location, heightAt, random);
    for (let index = 0; index < 18; index += 1) {
      const side = index % 2 ? 1 : -1;
      const x = side * randomBetween(random, 145, 265);
      const z = randomBetween(random, -720, 720);
      const tower = erodedMesa(location, random, randomBetween(random, .5, 1.05));
      tower.scale.x = randomBetween(random, .48, .9);
      group.add(place(tower, x, z, heightAt));
    }
  }
  if (location.landmark === "singingDune") {
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
    addCliffCorridor(group, location, heightAt, random, { chalk: true, oneSided: true });
    for (let index = 0; index < 9; index += 1) {
      const butte = erodedMesa(location, random, randomBetween(random, 1.8, 3.4), true);
      butte.scale.x = randomBetween(random, 1.5, 2.8);
      group.add(place(butte, -670 + index * 100, 420 + Math.sin(index * .8) * 100, heightAt));
    }
  }
  if (location.landmark === "bozzhyraFangs") {
    addCliffCorridor(group, location, heightAt, random, { chalk: true, oneSided: true });
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
  addRoad(group, location, heightAt);
  return group;
}
