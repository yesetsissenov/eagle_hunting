import fs from "node:fs";
import { ANIMALS } from "../src/data/animals.js";
import { LOCATIONS } from "../src/data/locations.js";

const requiredPages = ["index.html", "game.html", "collection.html"];
for (const page of requiredPages) {
  if (!fs.existsSync(new URL(`../${page}`, import.meta.url))) throw new Error(`Missing page: ${page}`);
}

const requiredAssets = [
  "assets/textures/kazakhstan-ground-atlas.webp",
  "assets/models/rat.glb",
  "assets/models/marmot.glb",
  "assets/models/duck.glb",
  "assets/models/goat.glb",
  "assets/models/fox.glb",
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
