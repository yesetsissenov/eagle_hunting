import * as THREE from "../../three.module.js";
import { createRandom, randomBetween, seedFromString } from "../core/random.js";
import { WORLD_HALF } from "./terrain.js";

const WOODED = new Set(["lakeGranite", "alpine", "alpineLake", "altai"]);
const ARID = new Set(["desert", "canyon", "chalkPlateau", "shore"]);

function placeMatrix(mesh, index, position, rotation, scale) {
  const matrix = new THREE.Matrix4();
  matrix.compose(position, new THREE.Quaternion().setFromEuler(rotation), scale);
  mesh.setMatrixAt(index, matrix);
}

function habitatScore(location, x, z, salt = 0) {
  const broad = Math.sin(x * .009 + salt) * Math.cos(z * .008 - salt * .7);
  const patches = Math.sin((x + z) * .021 + salt * 2.1) * .42 + Math.cos((x - z) * .015 - salt) * .34;
  if (location.terrain === "wetland") return broad * .25 + patches * .16 + .72;
  if (WOODED.has(location.terrain)) return broad * .48 + patches * .32 + .38;
  return broad * .34 + patches * .28 + .2;
}

function randomPoint(random, heightAt, location, { cluster = false, salt = 0, near = true } = {}) {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    let x;
    let z;
    if (near && random() < .68) {
      const angle = random() * Math.PI * 2;
      const distance = 95 + Math.sqrt(random()) * 680;
      x = Math.sin(angle) * distance;
      z = Math.cos(angle) * distance;
    } else {
      x = randomBetween(random, -WORLD_HALF + 24, WORLD_HALF - 24);
      z = randomBetween(random, -WORLD_HALF + 24, WORLD_HALF - 24);
    }
    if (Math.hypot(x, z) < 84) continue;
    if (cluster && habitatScore(location, x, z, salt) < randomBetween(random, -.2, .78)) continue;
    return new THREE.Vector3(x, heightAt(x, z), z);
  }
  const angle = random() * Math.PI * 2;
  const distance = randomBetween(random, 100, WORLD_HALF - 30);
  const x = Math.sin(angle) * distance;
  const z = Math.cos(angle) * distance;
  return new THREE.Vector3(x, heightAt(x, z), z);
}

function grassClumpGeometry(blades = 9) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  for (let index = 0; index < blades; index += 1) {
    const angle = index * 2.399963 + (index % 2) * .18;
    const radius = .1 + (index % 3) * .12;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const height = .72 + (index % 5) * .13;
    const width = .055 + (index % 3) * .012;
    const dx = Math.cos(angle + Math.PI / 2) * width;
    const dz = Math.sin(angle + Math.PI / 2) * width;
    const base = positions.length / 3;
    positions.push(x - dx, 0, z - dz, x + dx, 0, z + dz, x, height, z);
    normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    uvs.push(0, 0, 1, 0, .5, 1);
    indices.push(base, base + 1, base + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function addGrass(group, location, heightAt, random, mobile) {
  const count = Math.round((mobile ? 3600 : 9800) * location.density.grass);
  if (!count) return;
  const geometry = grassClumpGeometry(mobile ? 6 : 9);
  const material = new THREE.MeshStandardMaterial({
    color: location.palette.grass,
    roughness: 1,
    vertexColors: true,
    side: THREE.DoubleSide,
    alphaTest: .05,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = "grass-fields";
  const base = new THREE.Color(location.palette.grass);
  for (let index = 0; index < count; index += 1) {
    const point = randomPoint(random, heightAt, location, { cluster: true, salt: .7 });
    const size = randomBetween(random, .68, ARID.has(location.terrain) ? 1.7 : 2.25);
    placeMatrix(mesh, index, point, new THREE.Euler(0, random() * Math.PI, randomBetween(random, -.1, .1)), new THREE.Vector3(size, size, size));
    mesh.setColorAt(index, base.clone().offsetHSL(randomBetween(random, -.045, .045), randomBetween(random, -.15, .12), randomBetween(random, -.14, .12)));
  }
  mesh.receiveShadow = true;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  group.add(mesh);
}

function addTrees(group, location, heightAt, random, mobile, colliders) {
  const count = Math.round((mobile ? 260 : 720) * location.density.trees);
  if (!count) return;
  const conifer = WOODED.has(location.terrain);
  const trunkGeometry = new THREE.CylinderGeometry(.19, .42, 4.8, 7);
  trunkGeometry.translate(0, 2.4, 0);
  const trunks = new THREE.InstancedMesh(trunkGeometry, new THREE.MeshStandardMaterial({ color: conifer ? 0x594431 : 0x72513a, roughness: 1 }), count);
  trunks.name = conifer ? "pine-trunks" : "tree-trunks";
  const crownGeometries = conifer
    ? [[2.15, 3.6, 3.7], [1.86, 3.7, 5.25], [1.52, 3.5, 6.75], [1.05, 3.1, 8.1], [.62, 2.3, 9.2]].map(([radius, height, y], index) => {
        const geometry = new THREE.ConeGeometry(radius, height, 9);
        geometry.translate(index % 2 ? .12 : -.08, y, index % 3 ? .05 : -.08);
        return geometry;
      })
    : [[-1.05, 5.3, .1, 1.8, 1.3], [.95, 5.45, -.1, 1.7, 1.45], [0, 6.55, .2, 2.05, 1.65], [-.2, 7.6, -.25, 1.45, 1.25]].map(([x, y, z, radius, yScale]) => {
        const geometry = new THREE.IcosahedronGeometry(radius, 1);
        geometry.scale(1, yScale, 1);
        geometry.translate(x, y, z);
        return geometry;
      });
  const crowns = crownGeometries.map((geometry, index) => new THREE.InstancedMesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: location.palette.grass, roughness: 1, vertexColors: true, flatShading: index % 2 === 0 }),
    count,
  ));
  const crownBase = new THREE.Color(location.palette.grass).offsetHSL(conifer ? .015 : -.01, conifer ? .05 : -.02, conifer ? .015 : .035);
  for (let index = 0; index < count; index += 1) {
    const point = randomPoint(random, heightAt, location, { cluster: true, salt: 2.2 });
    const size = randomBetween(random, .72, 1.55);
    const rotation = new THREE.Euler(randomBetween(random, -.025, .025), random() * Math.PI * 2, randomBetween(random, -.035, .035));
    const scale = new THREE.Vector3(size * randomBetween(random, .82, 1.08), size, size * randomBetween(random, .82, 1.08));
    placeMatrix(trunks, index, point, rotation, scale);
    for (const crown of crowns) placeMatrix(crown, index, point, rotation, scale);
    if (index < (mobile ? 90 : 180)) colliders.push({ x: point.x, z: point.z, radius: 1.15 * size, height: 10.2 * size });
    const color = crownBase.clone().offsetHSL(randomBetween(random, -.03, .03), randomBetween(random, -.12, .1), randomBetween(random, -.11, .13));
    for (const crown of crowns) crown.setColorAt(index, color);
  }
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  trunks.instanceMatrix.needsUpdate = true;
  for (const crown of crowns) {
    crown.castShadow = true;
    crown.receiveShadow = true;
    crown.instanceMatrix.needsUpdate = true;
    crown.instanceColor.needsUpdate = true;
  }
  group.add(trunks, ...crowns);
}

function addRocks(group, location, heightAt, random, mobile, colliders) {
  const count = Math.round((mobile ? 210 : 560) * location.density.rocks);
  if (!count) return;
  const geometries = [new THREE.DodecahedronGeometry(1, 1), new THREE.IcosahedronGeometry(1, 1), new THREE.OctahedronGeometry(1, 1)];
  const meshes = geometries.map((geometry, index) => {
    geometry.rotateX(index * .37);
    return new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: location.palette.rock, roughness: .96, vertexColors: true, flatShading: true }), Math.ceil(count / geometries.length));
  });
  const used = [0, 0, 0];
  const base = new THREE.Color(location.palette.rock);
  for (let index = 0; index < count; index += 1) {
    const variant = index % meshes.length;
    const mesh = meshes[variant];
    const instance = used[variant]++;
    const point = randomPoint(random, heightAt, location, { cluster: index % 4 !== 0, salt: 4.1, near: index % 5 !== 0 });
    const scree = index % 7 !== 0;
    const size = scree ? randomBetween(random, .32, 1.9) : randomBetween(random, 2.2, 6.2);
    point.y += size * .28;
    placeMatrix(mesh, instance, point, new THREE.Euler(random() * .9, random() * Math.PI, random() * .9), new THREE.Vector3(size * randomBetween(random, .7, 1.55), size * randomBetween(random, .38, .9), size * randomBetween(random, .72, 1.45)));
    mesh.setColorAt(instance, base.clone().offsetHSL(randomBetween(random, -.018, .018), randomBetween(random, -.1, .07), randomBetween(random, -.17, .16)));
    if (size > 2.8 && colliders.length < (mobile ? 130 : 260)) colliders.push({ x: point.x, z: point.z, radius: size, height: size * .9 });
  }
  for (let index = 0; index < meshes.length; index += 1) {
    const mesh = meshes[index];
    mesh.count = used[index];
    mesh.name = `rock-field-${index + 1}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  }
}

function addBushes(group, location, heightAt, random, mobile) {
  const count = Math.round((mobile ? 280 : 780) * Math.max(.22, location.density.grass));
  const dry = ARID.has(location.terrain);
  const geometries = [new THREE.IcosahedronGeometry(.75, 1), new THREE.DodecahedronGeometry(.68, 1), new THREE.TetrahedronGeometry(.78, 1)];
  const meshes = geometries.map((geometry) => new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: location.palette.grass, roughness: 1, vertexColors: true, flatShading: true }), Math.ceil(count / geometries.length)));
  const used = [0, 0, 0];
  const base = new THREE.Color(location.palette.grass).offsetHSL(dry ? -.035 : .01, dry ? -.08 : .05, dry ? -.08 : -.13);
  for (let index = 0; index < count; index += 1) {
    const variant = index % meshes.length;
    const point = randomPoint(random, heightAt, location, { cluster: true, salt: 6.4 });
    const size = randomBetween(random, .48, dry ? 1.45 : 2.05);
    point.y += size * .4;
    placeMatrix(meshes[variant], used[variant]++, point, new THREE.Euler(randomBetween(random, -.15, .15), random() * Math.PI, randomBetween(random, -.15, .15)), new THREE.Vector3(size * randomBetween(random, 1.15, 1.9), size * randomBetween(random, .55, .95), size * randomBetween(random, .85, 1.35)));
    meshes[variant].setColorAt(used[variant] - 1, base.clone().offsetHSL(randomBetween(random, -.04, .04), randomBetween(random, -.1, .12), randomBetween(random, -.13, .12)));
  }
  meshes.forEach((mesh, index) => {
    mesh.count = used[index];
    mesh.name = `shrub-layer-${index + 1}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  });
}

function addReeds(group, location, heightAt, random, mobile) {
  if (!["wetland", "riverValley", "shore"].includes(location.terrain)) return;
  const count = mobile ? 520 : 1300;
  const geometry = new THREE.CylinderGeometry(.045, .07, 2.8, 5);
  geometry.translate(0, 1.4, 0);
  const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: 0x8b7a3c, roughness: 1, vertexColors: true }), count);
  const base = new THREE.Color(location.palette.grass).lerp(new THREE.Color(0xa4934f), .48);
  for (let index = 0; index < count; index += 1) {
    const point = randomPoint(random, heightAt, location, { cluster: true, salt: 9.2 });
    const size = randomBetween(random, .65, 1.55);
    placeMatrix(mesh, index, point, new THREE.Euler(randomBetween(random, -.08, .08), random() * Math.PI, randomBetween(random, -.08, .08)), new THREE.Vector3(size, size, size));
    mesh.setColorAt(index, base.clone().offsetHSL(randomBetween(random, -.025, .025), 0, randomBetween(random, -.12, .1)));
  }
  mesh.name = "reed-beds";
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  group.add(mesh);
}

export function createVegetation(location, heightAt, { mobile = false } = {}) {
  const group = new THREE.Group();
  group.name = "vegetation";
  const colliders = [];
  const random = createRandom(seedFromString(`${location.id}:vegetation:v2`));
  addGrass(group, location, heightAt, random, mobile);
  addTrees(group, location, heightAt, random, mobile, colliders);
  addRocks(group, location, heightAt, random, mobile, colliders);
  addBushes(group, location, heightAt, random, mobile);
  addReeds(group, location, heightAt, random, mobile);
  return { group, colliders };
}
