import * as THREE from "../../three.module.js";
import { createRandom, randomBetween, seedFromString } from "../core/random.js";
import { loadGroundTexture } from "./textures.js";

export const WORLD_SIZE = 1800;
export const WORLD_HALF = WORLD_SIZE / 2;
const TILE_SIZE = 256;
const MOSAIC_SIZE = TILE_SIZE * 3;
const EARTH_CIRCUMFERENCE = 40075016.686;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Не удалось загрузить рельеф: ${url}`));
    image.src = url;
  });
}

async function loadMosaic(location, onProgress) {
  const canvas = document.createElement("canvas");
  canvas.width = MOSAIC_SIZE;
  canvas.height = MOSAIC_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  let loaded = 0;
  const jobs = [];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const url = new URL(`../../assets/terrain/${location.id}/${column}_${row}.png`, import.meta.url);
      jobs.push(loadImage(url).then((image) => {
        context.drawImage(image, column * TILE_SIZE, row * TILE_SIZE);
        loaded += 1;
        onProgress?.(loaded / 9);
      }));
    }
  }
  await Promise.all(jobs);
  return context.getImageData(0, 0, MOSAIC_SIZE, MOSAIC_SIZE);
}

function readElevation(imageData, x, y) {
  const px = Math.max(0, Math.min(MOSAIC_SIZE - 1, x));
  const py = Math.max(0, Math.min(MOSAIC_SIZE - 1, y));
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const x1 = Math.min(MOSAIC_SIZE - 1, x0 + 1);
  const y1 = Math.min(MOSAIC_SIZE - 1, y0 + 1);
  const tx = px - x0;
  const ty = py - y0;
  const at = (sx, sy) => {
    const index = (sy * MOSAIC_SIZE + sx) * 4;
    const data = imageData.data;
    return data[index] * 256 + data[index + 1] + data[index + 2] / 256 - 32768;
  };
  const a = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
  const b = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
  return a * (1 - ty) + b * ty;
}

function verticalScale(location) {
  if (["alpine", "alpineLake", "altai"].includes(location.terrain)) return 0.2;
  if (["canyon", "chalkPlateau"].includes(location.terrain)) return 0.24;
  if (["plateau", "lakeGranite"].includes(location.terrain)) return 0.18;
  return 0.15;
}

function surfaceDetail(location, x, z) {
  const broad = Math.sin(x * 0.012 + 0.7) * Math.cos(z * 0.011 - 0.4);
  const fine = Math.sin(x * 0.053 + z * 0.037) * 0.45 + Math.cos(z * 0.071 - x * 0.019) * 0.3;
  if (location.terrain === "desert") return broad * 2.6 + Math.sin(x * 0.035 + z * 0.012) * 1.8;
  if (location.terrain === "canyon") return broad * 1.2 + fine * 0.7;
  if (location.terrain === "steppe" || location.terrain === "wetland") return broad * 1.4 + fine * 0.45;
  return broad * 1.8 + fine;
}

function bell(value, width) {
  return Math.exp(-((value / width) ** 2));
}

function signatureRelief(location, x, z) {
  const landmark = location.landmark;
  if (landmark === "castleValley") {
    const channel = Math.sin(z * .0065) * 48 + Math.sin(z * .017) * 17;
    const distance = Math.abs(x - channel);
    const floor = -34 * bell(distance, 48);
    const shoulder = 27 * bell(distance - 105, 62);
    const towers = Math.max(0, Math.sin(z * .024 + x * .009)) * bell(distance - 150, 75) * 13;
    return floor + shoulder + towers;
  }
  if (landmark === "singingDune") {
    const dx = x - 270;
    const dz = z - 205;
    const along = dx * .82 + dz * .57;
    const across = -dx * .57 + dz * .82;
    const main = 48 * bell(along, 310) * bell(across, 52);
    const lee = 16 * bell(along - 40, 270) * bell(across - 82, 88);
    return main + lee;
  }
  if (landmark === "chink") {
    const edge = 360 + Math.sin(x * .006) * 52;
    return (Math.tanh((z - edge) / 42) + 1) * 34 + Math.sin(x * .023) * bell(z - edge, 95) * 7;
  }
  if (landmark === "bozzhyraFangs") {
    const edge = 390 + Math.sin(x * .0055) * 68;
    const escarpment = (Math.tanh((z - edge) / 48) + 1) * 39;
    const mesaA = 56 * bell(x - 285, 85) * bell(z - 205, 62);
    const mesaB = 38 * bell(x + 230, 125) * bell(z - 80, 92);
    return escarpment + mesaA + mesaB;
  }
  if (["snowPeaks", "threeLakes", "sunkenForest", "altaiGlacier"].includes(landmark)) {
    const distance = Math.hypot(x, z);
    const valleyWalls = Math.max(0, (distance - 330) / 470) ** 1.45 * 58;
    const ridges = Math.max(0, Math.sin(Math.atan2(z, x) * 7 + distance * .011)) * Math.max(0, distance - 380) * .045;
    return valleyWalls + ridges;
  }
  if (landmark === "braidedRiver") {
    const channel = Math.sin(z * .008) * 95 + Math.sin(z * .021) * 22;
    return -9 * bell(x - channel, 82);
  }
  if (landmark === "wetlandPools" || landmark === "balkhashShore") return -Math.max(0, Math.hypot(x, z) - 520) * .004;
  return 0;
}

function flattenCamp(height, x, z) {
  const distance = Math.hypot(x, z);
  if (distance >= 72) return height;
  const factor = THREE.MathUtils.smoothstep(distance, 24, 72);
  return height * factor;
}

function fallbackElevation(location, x, z) {
  const ridge = Math.abs(Math.sin(x * 0.006) + Math.cos(z * 0.007)) ** 2;
  if (["alpine", "alpineLake", "altai"].includes(location.terrain)) return ridge * 90 + surfaceDetail(location, x, z) * 3;
  if (location.terrain === "canyon") {
    const channel = Math.exp(-Math.abs(x - Math.sin(z * 0.008) * 130) / 65);
    return 32 - channel * 42 + surfaceDetail(location, x, z) * 2;
  }
  if (location.terrain === "chalkPlateau") return Math.round((ridge * 45) / 14) * 14 + surfaceDetail(location, x, z);
  return surfaceDetail(location, x, z) * 4;
}

function fallbackGroundTexture(location) {
  const random = createRandom(seedFromString(`${location.id}:ground`));
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const base = new THREE.Color(location.palette.ground);
  context.fillStyle = `#${base.getHexString()}`;
  context.fillRect(0, 0, 512, 512);
  for (let index = 0; index < 3800; index += 1) {
    const shade = randomBetween(random, -0.12, 0.14);
    const color = base.clone().offsetHSL(randomBetween(random, -0.015, 0.015), randomBetween(random, -0.08, 0.06), shade);
    context.fillStyle = `#${color.getHexString()}`;
    const size = randomBetween(random, 0.6, 3.5);
    context.globalAlpha = randomBetween(random, 0.08, 0.32);
    context.fillRect(random() * 512, random() * 512, size * 2.5, size);
  }
  context.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(30, 30);
  texture.anisotropy = 4;
  return texture;
}

export async function createTerrain(location, { mobile = false, onProgress } = {}) {
  let mosaic = null;
  try {
    mosaic = await loadMosaic(location, onProgress);
  } catch (error) {
    console.warn(error);
  }

  const [latitude] = location.coordinates;
  const tileMeters = Math.cos(latitude * Math.PI / 180) * EARTH_CIRCUMFERENCE / (2 ** 11);
  const pixelsPerGameUnit = (12000 / WORLD_SIZE) * TILE_SIZE / tileMeters;
  const centerX = TILE_SIZE * (1 + location.tileUv[0]);
  const centerY = TILE_SIZE * (1 + location.tileUv[1]);
  const baseElevation = mosaic ? readElevation(mosaic, centerX, centerY) : 0;
  const scale = verticalScale(location);

  const rawHeightAt = (x, z) => {
    if (!mosaic) return fallbackElevation(location, x, z) + signatureRelief(location, x, z);
    const elevation = readElevation(mosaic, centerX + x * pixelsPerGameUnit, centerY + z * pixelsPerGameUnit);
    return (elevation - baseElevation) * scale + surfaceDetail(location, x, z) + signatureRelief(location, x, z);
  };
  const heightAt = (x, z) => flattenCamp(rawHeightAt(x, z), x, z);

  const segments = mobile ? 104 : 152;
  const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const ground = new THREE.Color(location.palette.ground);
  const grass = new THREE.Color(location.palette.grass);
  const rock = new THREE.Color(location.palette.rock);
  const random = createRandom(seedFromString(`${location.id}:terrain-color`));
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const z = position.getZ(index);
    const y = heightAt(x, z);
    position.setY(index, y);
    const slope = Math.abs(heightAt(x + 5, z) - y) + Math.abs(heightAt(x, z + 5) - y);
    const greenAmount = Math.max(0.08, Math.min(0.72, 0.58 - slope * 0.035));
    const color = ground.clone().lerp(grass, greenAmount).lerp(rock, Math.min(0.75, slope * 0.06));
    color.offsetHSL(randomBetween(random, -0.008, 0.008), 0, randomBetween(random, -0.035, 0.035));
    color.toArray(colors, index * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  position.needsUpdate = true;

  let texture;
  try {
    texture = await loadGroundTexture(location);
  } catch {
    texture = fallbackGroundTexture(location);
  }
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.userData.source = mosaic ? "Mapzen Terrarium / SRTM" : "procedural fallback";
  return { mesh, heightAt, source: mesh.userData.source };
}
