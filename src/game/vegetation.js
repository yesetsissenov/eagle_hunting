import * as THREE from "../../three.module.js";
import { createRandom, randomBetween, seedFromString } from "../core/random.js";
import { WORLD_HALF } from "./terrain.js";

function placeMatrix(mesh, index, position, rotation, scale) {
  const matrix = new THREE.Matrix4();
  matrix.compose(position, new THREE.Quaternion().setFromEuler(rotation), scale);
  mesh.setMatrixAt(index, matrix);
}

function randomPoint(random, heightAt) {
  let x;
  let z;
  do {
    x = randomBetween(random, -WORLD_HALF + 30, WORLD_HALF - 30);
    z = randomBetween(random, -WORLD_HALF + 30, WORLD_HALF - 30);
  } while (Math.hypot(x, z) < 92);
  return new THREE.Vector3(x, heightAt(x, z), z);
}

function addGrass(group, location, heightAt, random, mobile) {
  const count = Math.round((mobile ? 520 : 1300) * location.density.grass);
  if (!count) return;
  const geometry = new THREE.ConeGeometry(0.18, 1.3, 3);
  geometry.translate(0, 0.65, 0);
  const material = new THREE.MeshStandardMaterial({ color: location.palette.grass, roughness: 1, vertexColors: true });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const base = new THREE.Color(location.palette.grass);
  for (let index = 0; index < count; index += 1) {
    const point = randomPoint(random, heightAt);
    const size = randomBetween(random, 0.55, 1.8);
    placeMatrix(mesh, index, point, new THREE.Euler(0, random() * Math.PI, randomBetween(random, -0.12, 0.12)), new THREE.Vector3(size, size, size));
    mesh.setColorAt(index, base.clone().offsetHSL(randomBetween(random, -0.035, 0.035), randomBetween(random, -0.12, 0.08), randomBetween(random, -0.12, 0.1)));
  }
  mesh.receiveShadow = true;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  group.add(mesh);
}

function addTrees(group, location, heightAt, random, mobile, colliders) {
  const count = Math.round((mobile ? 65 : 150) * location.density.trees);
  if (!count) return;
  const conifer = ["alpine", "alpineLake", "altai", "lakeGranite"].includes(location.terrain);
  const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.25, 3.4, 7);
  trunkGeometry.translate(0, 1.7, 0);
  const trunks = new THREE.InstancedMesh(trunkGeometry, new THREE.MeshStandardMaterial({ color: 0x5a3f2b, roughness: 1 }), count);
  const crownGeometries = conifer
    ? [
        [1.45, 3.2, 3.2],
        [1.18, 2.8, 4.55],
        [.84, 2.2, 5.75],
      ].map(([radius, height, y]) => {
        const geometry = new THREE.ConeGeometry(radius, height, 9);
        geometry.translate(0, y, 0);
        return geometry;
      })
    : [
        [-.55, 3.85, 0, 1.15],
        [.55, 4.1, .15, 1.05],
        [0, 4.75, -.15, 1.2],
      ].map(([x, y, z, radius]) => {
        const geometry = new THREE.IcosahedronGeometry(radius, 1);
        geometry.translate(x, y, z);
        return geometry;
      });
  const crowns = crownGeometries.map((geometry) => new THREE.InstancedMesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: location.palette.grass, roughness: 1, vertexColors: true }),
    count,
  ));
  const crownBase = new THREE.Color(location.palette.grass).offsetHSL(0, conifer ? .08 : -.02, conifer ? -.08 : .02);
  for (let index = 0; index < count; index += 1) {
    const point = randomPoint(random, heightAt);
    const size = randomBetween(random, 0.8, 1.9);
    const rotation = new THREE.Euler(0, random() * Math.PI * 2, randomBetween(random, -0.035, 0.035));
    const scale = new THREE.Vector3(size * randomBetween(random, 0.82, 1.08), size, size * randomBetween(random, 0.82, 1.08));
    placeMatrix(trunks, index, point, rotation, scale);
    for (const crown of crowns) placeMatrix(crown, index, point, rotation, scale);
    colliders.push({ x: point.x, z: point.z, radius: .9 * size, height: 6.7 * size });
    const color = crownBase.clone().offsetHSL(randomBetween(random, -0.025, 0.025), randomBetween(random, -0.1, 0.1), randomBetween(random, -0.08, 0.12));
    for (const crown of crowns) crown.setColorAt(index, color);
  }
  trunks.castShadow = true;
  trunks.instanceMatrix.needsUpdate = true;
  for (const crown of crowns) {
    crown.castShadow = true;
    crown.instanceMatrix.needsUpdate = true;
    crown.instanceColor.needsUpdate = true;
  }
  group.add(trunks, ...crowns);
}

function addRocks(group, location, heightAt, random, mobile, colliders) {
  const count = Math.round((mobile ? 80 : 180) * location.density.rocks);
  if (!count) return;
  const geometry = new THREE.DodecahedronGeometry(1, 1);
  const material = new THREE.MeshStandardMaterial({ color: location.palette.rock, roughness: 0.92, vertexColors: true });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const base = new THREE.Color(location.palette.rock);
  for (let index = 0; index < count; index += 1) {
    const point = randomPoint(random, heightAt);
    const size = randomBetween(random, 0.45, 2.6);
    point.y += size * 0.35;
    placeMatrix(
      mesh,
      index,
      point,
      new THREE.Euler(random() * 0.7, random() * Math.PI, random() * 0.7),
      new THREE.Vector3(size * randomBetween(random, 0.65, 1.35), size * randomBetween(random, 0.35, 0.85), size * randomBetween(random, 0.7, 1.45)),
    );
    mesh.setColorAt(index, base.clone().offsetHSL(0, randomBetween(random, -0.08, 0.06), randomBetween(random, -0.13, 0.14)));
    if (size > 1.35) colliders.push({ x: point.x, z: point.z, radius: size, height: size * .85 });
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  group.add(mesh);
}

function addBushes(group, location, heightAt, random, mobile) {
  const count = Math.round((mobile ? 55 : 120) * Math.max(0.25, location.density.grass));
  const geometry = new THREE.IcosahedronGeometry(0.75, 1);
  const material = new THREE.MeshStandardMaterial({ color: location.palette.grass, roughness: 1, vertexColors: true });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const base = new THREE.Color(location.palette.grass).multiplyScalar(0.78);
  for (let index = 0; index < count; index += 1) {
    const point = randomPoint(random, heightAt);
    const size = randomBetween(random, 0.45, 1.55);
    point.y += size * 0.35;
    placeMatrix(mesh, index, point, new THREE.Euler(0, random() * Math.PI, 0), new THREE.Vector3(size * 1.4, size * 0.7, size));
    mesh.setColorAt(index, base.clone().offsetHSL(randomBetween(random, -0.03, 0.03), 0, randomBetween(random, -0.1, 0.08)));
  }
  mesh.castShadow = true;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  group.add(mesh);
}

export function createVegetation(location, heightAt, { mobile = false } = {}) {
  const group = new THREE.Group();
  group.name = "vegetation";
  const colliders = [];
  const random = createRandom(seedFromString(`${location.id}:vegetation`));
  addGrass(group, location, heightAt, random, mobile);
  addTrees(group, location, heightAt, random, mobile, colliders);
  addRocks(group, location, heightAt, random, mobile, colliders);
  addBushes(group, location, heightAt, random, mobile);
  return { group, colliders };
}
