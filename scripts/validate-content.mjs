import fs from "node:fs";
import { ANIMALS } from "../src/data/animals.js";
import { LOCATIONS } from "../src/data/locations.js";

const requiredPages = ["index.html", "game.html", "collection.html"];
for (const page of requiredPages) {
  if (!fs.existsSync(new URL(`../${page}`, import.meta.url))) throw new Error(`Missing page: ${page}`);
}

const requiredAssets = [
  "assets/textures/kazakhstan-ground-atlas.webp",
  "assets/models/golden-eagle.glb",
  "assets/models/mouse-real.glb",
  "assets/models/hamster-real.glb",
  "assets/models/squirrel-real.glb",
  "assets/models/hare-real.glb",
  "assets/models/marmot.glb",
  "assets/models/fox-real.glb",
  "assets/models/badger-real.glb",
  "assets/models/ferret-real.glb",
  "assets/models/quail-real.glb",
  "assets/models/pheasant-real.glb",
  "assets/models/mallard-real.glb",
  "assets/models/saiga-real.glb",
  "assets/models/donkey-real.glb",
  "assets/models/ibex-real.glb",
  "assets/models/argali-real.glb",
  "assets/models/flamingo-real.glb",
  "assets/models/crane-real.glb",
  "assets/models/deer-real.glb",
  "assets/models/snow-leopard-real.glb",
];
for (const asset of requiredAssets) {
  const url = new URL(`../${asset}`, import.meta.url);
  if (!fs.existsSync(url) || fs.statSync(url).size === 0) throw new Error(`Missing asset: ${asset}`);
}

for (const location of LOCATIONS) {
  const terrainDir = new URL(`../assets/terrain/${location.id}/`, import.meta.url);
  if (!fs.existsSync(terrainDir)) throw new Error(`Missing terrain directory: ${location.id}`);
  const tiles = fs.readdirSync(terrainDir).filter((name) => name.endsWith(".png"));
  if (tiles.length !== 9) throw new Error(`${location.id}: expected 9 terrain tiles, got ${tiles.length}`);
  for (const animalId of Object.keys(location.wildlife)) {
    if (!ANIMALS[animalId]) throw new Error(`${location.id}: unknown animal ${animalId}`);
  }
}

console.log(`Content OK: ${LOCATIONS.length} locations, ${Object.keys(ANIMALS).length} animals, 3 pages.`);
