import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCATIONS } from "../src/data/locations.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/11";

for (const location of LOCATIONS) {
  const directory = path.join(root, "assets", "terrain", location.id);
  await fs.mkdir(directory, { recursive: true });
  const [centerX, centerY] = location.tile;
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const x = centerX + offsetX;
      const y = centerY + offsetY;
      const output = path.join(directory, `${offsetX + 1}_${offsetY + 1}.png`);
      try {
        await fs.access(output);
        continue;
      } catch {
        // Download below.
      }
      const response = await fetch(`${base}/${x}/${y}.png`);
      if (!response.ok) throw new Error(`${location.id}: ${response.status} for tile ${x}/${y}`);
      await fs.writeFile(output, Buffer.from(await response.arrayBuffer()));
      process.stdout.write(`terrain ${location.id} ${offsetX + 1}_${offsetY + 1}\n`);
    }
  }
}
