import * as THREE from "../../three.module.js";

const atlasUrl = new URL("../../assets/textures/kazakhstan-ground-atlas.webp", import.meta.url);
let atlasPromise;

function loadAtlas() {
  if (atlasPromise) return atlasPromise;
  atlasPromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось загрузить атлас природных материалов"));
    image.src = atlasUrl;
  });
  return atlasPromise;
}

export async function loadAtlasCell(index, repeat = 1) {
  const image = await loadAtlas();
  const column = index % 4;
  const row = Math.floor(index / 4);
  const cellWidth = image.width / 4;
  const cellHeight = image.height / 4;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  context.drawImage(image, column * cellWidth, row * cellHeight, cellWidth, cellHeight, 0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 4;
  return texture;
}

const GROUND_CELL = {
  saryarka: 0,
  burabay: 1,
  bayanaul: 2,
  korgalzhyn: 3,
  alatau: 4,
  assy: 5,
  kolsai: 6,
  kaindy: 7,
  charyn: 8,
  altynemel: 9,
  ili: 10,
  balkhash: 11,
  katon: 12,
  ustyurt: 13,
  bozzhyra: 14,
};

export function loadGroundTexture(location) {
  return loadAtlasCell(GROUND_CELL[location.id] ?? 0, 32);
}

export function loadFeatherTexture() {
  return loadAtlasCell(15, 1.3);
}
