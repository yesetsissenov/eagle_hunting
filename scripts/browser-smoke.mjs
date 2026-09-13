import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { LOCATIONS } from "../src/data/locations.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = path.join(root, "test-results");
fs.mkdirSync(results, { recursive: true });

const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
};

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filename = path.resolve(root, relative);
  if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || fs.statSync(filename).isDirectory()) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": mime[path.extname(filename)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(filename).pipe(response);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;
const browserPaths = process.platform === "win32"
  ? ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"]
  : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
const executablePath = browserPaths.find((candidate) => fs.existsSync(candidate));
if (!executablePath) throw new Error("A Chromium browser is required for the smoke test");

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function monitor(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (entry) => { if (entry.type() === "error") errors.push(entry.text()); });
  return errors;
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const desktopErrors = await monitor(desktop);
  await desktop.goto(`${baseUrl}/index.html`, { waitUntil: "networkidle" });
  assert(await desktop.locator(".location-card").count() === 15, "Home page must show 15 locations");
  await desktop.screenshot({ path: path.join(results, "home-desktop.png"), fullPage: true });

  await desktop.goto(`${baseUrl}/game.html?location=saryarka`, { waitUntil: "domcontentloaded" });
  await desktop.waitForFunction(() => window.__bkOK === true, null, { timeout: 30000 });
  const desktopState = await desktop.evaluate(() => ({
    terrain: window.__bkGame.terrainSource,
    location: window.__bkGame.location,
    externalAnimalCount: window.__bkGame.externalAnimalCount,
    eagleSource: window.__bkGame.eagleSource,
    vegetationLayers: window.__bkGame.vegetationLayers,
    canvas: [document.querySelector("#world").width, document.querySelector("#world").height],
  }));
  assert(desktopState.terrain.includes("SRTM"), "Desktop game must use SRTM terrain");
  assert(desktopState.location === "saryarka", "Desktop game opened the wrong location");
  assert(desktopState.externalAnimalCount >= 20, "Most spawned fauna must use recognisable GLB animal models");
  assert(desktopState.eagleSource === "rigged-golden-eagle-glb", "The player must use the rigged eagle model");
  assert(desktopState.vegetationLayers >= 7, "The world must contain layered vegetation and rocks");
  await desktop.screenshot({ path: path.join(results, "game-desktop.png") });
  assert(desktopErrors.length === 0, `Desktop console errors: ${desktopErrors.join(" | ")}`);

  await desktop.evaluate(() => {
    const profile = JSON.parse(localStorage.getItem("berkutchi_profile_v4"));
    profile.challenges = { preview: Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`star${index}`, true])) };
    localStorage.setItem("berkutchi_profile_v4", JSON.stringify(profile));
  });
  await desktop.goto(`${baseUrl}/game.html?location=bozzhyra`, { waitUntil: "domcontentloaded" });
  await desktop.waitForFunction(() => window.__bkOK === true, null, { timeout: 30000 });
  assert(await desktop.evaluate(() => window.__bkGame.location) === "bozzhyra", "Mastery must unlock Bozzhyra");
  await desktop.screenshot({ path: path.join(results, "game-bozzhyra.png") });
  assert(desktopErrors.length === 0, `Bozzhyra console errors: ${desktopErrors.join(" | ")}`);
  for (const location of LOCATIONS.filter(({ id }) => !["saryarka", "bozzhyra"].includes(id))) {
    await desktop.goto(`${baseUrl}/game.html?location=${location.id}`, { waitUntil: "domcontentloaded" });
    await desktop.waitForFunction(() => window.__bkOK === true, null, { timeout: 30000 });
    assert(await desktop.evaluate(() => window.__bkGame.location) === location.id, `Failed to open ${location.id}`);
    if (["kolsai", "charyn", "altynemel"].includes(location.id)) {
      await desktop.screenshot({ path: path.join(results, `game-${location.id}.png`) });
    }
  }
  assert(desktopErrors.length === 0, `Location console errors: ${desktopErrors.join(" | ")}`);
  await desktop.goto("about:blank");

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const mobilePage = await mobileContext.newPage();
  const mobileErrors = await monitor(mobilePage);
  await mobilePage.goto(`${baseUrl}/game.html?location=saryarka`, { waitUntil: "domcontentloaded" });
  await mobilePage.waitForFunction(() => window.__bkOK === true, null, { timeout: 45000 });
  assert(await mobilePage.locator("#touchControls").isVisible(), "Touch controls must be visible on a phone");
  await mobilePage.locator("#visionButton").tap();
  assert(await mobilePage.locator("#visionButton").getAttribute("aria-pressed") === "true", "Vision must toggle with one tap");
  const beforeYaw = await mobilePage.evaluate(() => window.__bkGame.state.eagle.yaw);
  const box = await mobilePage.locator(".joystick-base").boundingBox();
  assert(box, "Joystick is not laid out");
  await mobilePage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await mobilePage.mouse.down();
  await mobilePage.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 4 });
  await mobilePage.waitForTimeout(450);
  await mobilePage.mouse.up();
  const afterYaw = await mobilePage.evaluate(() => window.__bkGame.state.eagle.yaw);
  assert(Math.abs(afterYaw - beforeYaw) > .01, "Joystick must turn the eagle");
  await mobilePage.screenshot({ path: path.join(results, "game-mobile.png") });
  assert(mobileErrors.length === 0, `Mobile console errors: ${mobileErrors.join(" | ")}`);
  await mobileContext.close();

  await desktop.goto(`${baseUrl}/collection.html`, { waitUntil: "networkidle" });
  assert(await desktop.locator(".animal-card").count() === 28, "Collection must show 28 species");
  assert(await desktop.locator(".mastery-card").count() === 15, "Collection must show 15 mastery cards");
  assert(desktopErrors.length === 0, `Collection console errors: ${desktopErrors.join(" | ")}`);
  await desktop.close();
  console.log("Browser smoke OK: all 15 worlds, phone controls, animated GLB fauna, 28 species.");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
