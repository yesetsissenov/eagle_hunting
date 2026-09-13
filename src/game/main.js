import * as THREE from "../../three.module.js";
import { ANIMALS } from "../data/animals.js";
import { getLocation } from "../data/locations.js";
import { applyDelivery, challengeList, locationUnlocked, mainGoalComplete, totalStars } from "../core/progression.js";
import { loadProfile, saveProfile } from "../core/storage.js";
import { InputController } from "./input-controller.js";
import { createAnimalModel, createEagle } from "./models.js";
import { drawOverlay } from "./overlay.js";
import { Soundscape } from "./sound.js";
import { loadFeatherTexture } from "./textures.js";
import { WORLD_HALF } from "./terrain.js";
import { createGameWorld } from "./world.js";

const canvas = document.querySelector("#world");
const overlay = document.querySelector("#overlay");
const overlayContext = overlay.getContext("2d");
const loading = document.querySelector("#loading");
const loadingBar = document.querySelector("#loadingBar");
const loadingTitle = document.querySelector("#loadingTitle");
const loadingNote = document.querySelector("#loadingNote");
const mobile = matchMedia("(pointer: coarse)").matches || innerWidth <= 760;
const sound = new Soundscape();

function createSkyBackground(location) {
  const sky = new THREE.Color(location.palette.sky);
  const haze = new THREE.Color(location.palette.fog);
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, `#${sky.clone().offsetHSL(0, .05, -.12).getHexString()}`);
  gradient.addColorStop(.55, `#${sky.getHexString()}`);
  gradient.addColorStop(1, `#${haze.clone().offsetHSL(0, -.08, .08).getHexString()}`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let profile = loadProfile();
const requestedLocation = new URLSearchParams(location.search).get("location") || profile.selectedLocation;
let gameLocation = getLocation(requestedLocation);
if (!locationUnlocked(gameLocation, profile)) gameLocation = getLocation("saryarka");
profile.selectedLocation = gameLocation.id;
profile = saveProfile(profile);

document.title = `${gameLocation.name} — Беркутчи`;
document.querySelector("#locationName").textContent = gameLocation.name;
document.querySelector("#regionName").textContent = gameLocation.region;
loadingTitle.textContent = gameLocation.name;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.35 : 1.8));
renderer.shadowMap.enabled = !mobile;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = createSkyBackground(gameLocation);
scene.fog = new THREE.Fog(gameLocation.palette.fog, 260, 1180);
const camera = new THREE.PerspectiveCamera(61, 1, .1, 2200);
const hemi = new THREE.HemisphereLight(gameLocation.palette.sky, gameLocation.palette.ground, 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffefd0, 2.25);
sun.position.set(-180, 310, -160);
sun.castShadow = !mobile;
sun.shadow.mapSize.set(mobile ? 512 : 1536, mobile ? 512 : 1536);
sun.shadow.camera.left = -150;
sun.shadow.camera.right = 150;
sun.shadow.camera.top = 150;
sun.shadow.camera.bottom = -150;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 700;
scene.add(sun, sun.target);

let viewWidth = 1;
let viewHeight = 1;
function resize() {
  viewWidth = innerWidth;
  viewHeight = innerHeight;
  renderer.setSize(viewWidth, viewHeight, false);
  camera.aspect = viewWidth / viewHeight;
  camera.updateProjectionMatrix();
  const ratio = Math.min(devicePixelRatio, mobile ? 1.35 : 1.8);
  overlay.width = Math.round(viewWidth * ratio);
  overlay.height = Math.round(viewHeight * ratio);
  overlayContext.setTransform(ratio, 0, 0, ratio, 0, 0);
}
addEventListener("resize", resize);
resize();

let world;
let input;
let carriedModel = null;
let paused = false;
const eagle = {
  position: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0, speed: 34,
  altitude: 50, diving: false, vision: false, focus: 1, lift: 0, hitCooldown: 0,
  target: null, carrying: null,
};
const state = { eagle, target: null, time: 0, hitFlash: 0 };
let run = createRun();

function createRun() {
  return {
    startedAt: performance.now(),
    spottedSpecies: new Set(),
    collisions: 0,
    catchWasDive: false,
    catchSpeed: 0,
    deliverySeconds: Number.POSITIVE_INFINITY,
  };
}

function message(text, emphasis = false) {
  const element = document.createElement("div");
  element.className = "message";
  if (emphasis) element.style.borderColor = "rgba(226,189,104,.8)";
  element.textContent = text;
  document.querySelector("#messages").appendChild(element);
  setTimeout(() => element.remove(), 3250);
}

function recordSighting(animal) {
  const animalId = animal.animalId;
  run.spottedSpecies.add(animalId);
  if (profile.sightings[animalId]) return;
  profile = saveProfile({ ...profile, sightings: { ...profile.sightings, [animalId]: 1 } });
  if (animal.definition.kind === "wildlife") message(`Редкая встреча: ${animal.definition.name}. Только наблюдение.`, true);
}

function pickTarget(screenX, screenY) {
  if (paused || !eagle.vision) return;
  const point = new THREE.Vector3();
  let best = null;
  let bestDistance = mobile ? 68 : 52;
  for (const animal of world.animals) {
    if (animal.mode === "gone") continue;
    point.copy(animal.model.position);
    point.y += animal.definition.size;
    point.project(camera);
    if (point.z < -1 || point.z > 1) continue;
    const x = (point.x + 1) * .5 * viewWidth;
    const y = (1 - point.y) * .5 * viewHeight;
    const distance = Math.hypot(screenX - x, screenY - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = animal;
    }
  }
  if (!best) {
    message("Цель не выбрана — наведи круг точнее");
    return;
  }
  recordSighting(best);
  if (best.definition.kind === "wildlife") {
    message(`${best.definition.name}: охраняемый вид, наблюдай с высоты`, true);
    return;
  }
  state.target = state.target === best ? null : best;
  eagle.target = state.target;
  if (state.target) {
    sound.ensure();
    sound.target();
    message(`Цель: ${best.definition.name}. Сблизься и уходи в пике.`);
  }
}

function updateSightings() {
  if (!eagle.vision) return;
  for (const animal of world.animals) {
    if (animal.mode === "gone") continue;
    if (Math.hypot(eagle.position.x - animal.x, eagle.position.z - animal.z) < 620) recordSighting(animal);
  }
}

function attachPrey(animalId) {
  carriedModel = createAnimalModel(animalId);
  carriedModel.scale.multiplyScalar(.34);
  carriedModel.position.set(0, -1.15, .15);
  carriedModel.rotation.set(Math.PI / 2, 0, Math.PI);
  eagle.model.add(carriedModel);
}

function catchAnimal(animal) {
  eagle.carrying = animal.animalId;
  run.catchWasDive = eagle.diving;
  run.catchSpeed = eagle.speed;
  world.removeAnimal(animal, 9);
  state.target = null;
  eagle.target = null;
  attachPrey(animal.animalId);
  sound.catch();
  const discovered = !profile.collection[animal.animalId];
  message(`${discovered ? "Новый вид! " : ""}${animal.definition.name} в когтях — возвращайся к стоянке.`, discovered);
}

function completeDelivery() {
  run.deliverySeconds = (performance.now() - run.startedAt) / 1000;
  const result = applyDelivery(profile, { animalId: eagle.carrying, location: gameLocation, run });
  profile = saveProfile(result.profile);
  eagle.model.remove(carriedModel);
  carriedModel = null;
  eagle.carrying = null;
  sound.reward();
  message(`Доставка: +${result.reward} 🪙${result.firstDiscovery ? " · бонус за новый вид" : ""}`, true);
  if (result.newlyCompleted.length) {
    const names = challengeList(gameLocation).filter((item) => result.newlyCompleted.includes(item.id)).map((item) => item.name).join(", ");
    message(`Новое мастерство: ${names} · +${result.challengeCoins} 🪙`, true);
  }
  if (mainGoalComplete(profile)) message("Путь мастера завершён. Ты — Саятшылық шебері!", true);
  run = createRun();
  eagle.position.set(0, world.heightAt(0, 28) + 42, 28);
  eagle.yaw = 0;
  eagle.speed = 32;
  updatePauseContent();
}

function registerCollision(text) {
  if (eagle.hitCooldown > 0) return;
  eagle.hitCooldown = .9;
  eagle.lift = .65;
  eagle.speed = Math.max(12, eagle.speed * .48);
  state.hitFlash = .65;
  run.collisions += 1;
  sound.hit();
  message(text);
}

function updateEagle(dt) {
  const handling = 1 + (profile.upgrades.handling ?? 0) * .13;
  const endurance = profile.upgrades.endurance ?? 0;
  let steerX = input.state.steerX;
  const steerY = input.state.steerY;
  if (state.target && state.target.mode !== "gone" && !eagle.carrying && Math.abs(steerX) < .22) {
    let difference = Math.atan2(state.target.x - eagle.position.x, state.target.z - eagle.position.z) - eagle.yaw;
    difference = Math.atan2(Math.sin(difference), Math.cos(difference));
    steerX = THREE.MathUtils.clamp(difference * 1.7, -.82, .82);
  }
  eagle.roll += (-steerX * .88 - eagle.roll) * Math.min(1, dt * 5.2 * handling);
  eagle.yaw -= eagle.roll * 1.22 * handling * dt;
  eagle.diving = input.state.dive && eagle.lift <= 0;

  const ground = world.heightAt(eagle.position.x, eagle.position.z);
  if (eagle.diving) {
    eagle.position.y -= (28 + eagle.speed * .52) * dt;
    eagle.speed += (86 + endurance * 4 - eagle.speed) * Math.min(1, dt * 1.8);
    eagle.pitch += (-.72 - eagle.pitch) * Math.min(1, dt * 4.5);
  } else {
    const cruiseHeight = ground + 48 + -steerY * 38;
    eagle.position.y += (cruiseHeight - eagle.position.y) * Math.min(1, dt * 1.25);
    const desiredSpeed = input.state.boost ? 37 + endurance * 3 : 22 + endurance * 2;
    eagle.speed += (desiredSpeed - eagle.speed) * Math.min(1, dt * 1.35);
    eagle.pitch += ((cruiseHeight - eagle.position.y) * .01 - eagle.pitch) * Math.min(1, dt * 3.2);
  }
  if (eagle.lift > 0) {
    eagle.lift -= dt;
    eagle.position.y += 32 * dt;
  }
  if (eagle.hitCooldown > 0) eagle.hitCooldown -= dt;

  eagle.position.x += Math.sin(eagle.yaw) * eagle.speed * dt;
  eagle.position.z += Math.cos(eagle.yaw) * eagle.speed * dt;
  const nextGround = world.heightAt(eagle.position.x, eagle.position.z);
  if (eagle.position.y < nextGround + 2.7) {
    eagle.position.y = nextGround + 2.7;
    if (eagle.diving) registerCollision("Слишком низко: пике сорвано");
  }
  if (eagle.position.y > nextGround + 170) eagle.position.y = nextGround + 170;
  eagle.altitude = eagle.position.y - nextGround;

  for (const collider of world.colliders) {
    const distance = Math.hypot(eagle.position.x - collider.x, eagle.position.z - collider.z);
    if (distance >= collider.radius || eagle.position.y > world.heightAt(collider.x, collider.z) + collider.height) continue;
    const angle = Math.atan2(eagle.position.x - collider.x, eagle.position.z - collider.z);
    eagle.position.x = collider.x + Math.sin(angle) * (collider.radius + .5);
    eagle.position.z = collider.z + Math.cos(angle) * (collider.radius + .5);
    registerCollision("Столкновение: испытание чистого возвращения сброшено");
    break;
  }

  const boundary = Math.hypot(eagle.position.x, eagle.position.z);
  if (boundary > WORLD_HALF - 35) {
    let home = Math.atan2(-eagle.position.x, -eagle.position.z) - eagle.yaw;
    home = Math.atan2(Math.sin(home), Math.cos(home));
    eagle.yaw += home * Math.min(1, dt * 1.5);
  }
  if (boundary > WORLD_HALF) {
    const factor = WORLD_HALF / boundary;
    eagle.position.x *= factor;
    eagle.position.z *= factor;
  }

  eagle.vision = input.state.vision;
  const visionDuration = 6.5 * (1 + (profile.upgrades.vision ?? 0) * .25);
  if (eagle.vision) {
    eagle.focus = Math.max(0, eagle.focus - dt / visionDuration);
    if (eagle.focus === 0) input.setVision(false);
  } else {
    eagle.focus = Math.min(1, eagle.focus + dt / 4.8);
  }

  if (eagle.carrying) {
    const homeDistance = Math.hypot(eagle.position.x, eagle.position.z);
    if (homeDistance < 165 && Math.abs(steerX) < .25) {
      let home = Math.atan2(-eagle.position.x, -eagle.position.z) - eagle.yaw;
      home = Math.atan2(Math.sin(home), Math.cos(home));
      eagle.yaw += home * Math.min(1, dt * 1.35);
    }
    if (homeDistance < 21) completeDelivery();
  } else if (eagle.diving && eagle.altitude < 6.2) {
    for (const animal of world.animals) {
      if (animal.mode === "gone" || animal.definition.kind !== "prey") continue;
      const catchRadius = 3.2 + animal.definition.size * 1.1;
      if (Math.hypot(eagle.position.x - animal.x, eagle.position.z - animal.z) < catchRadius) {
        catchAnimal(animal);
        break;
      }
    }
  }

  eagle.model.position.copy(eagle.position);
  eagle.model.rotation.set(-eagle.pitch, eagle.yaw, eagle.roll, "YXZ");
  eagle.model.userData.animate({ time: state.time, diving: eagle.diving, speed: eagle.speed });
  sun.position.set(eagle.position.x - 170, eagle.position.y + 280, eagle.position.z - 130);
  sun.target.position.set(eagle.position.x, world.heightAt(eagle.position.x, eagle.position.z), eagle.position.z);
}

function updateCamera(dt, immediate = false) {
  const back = new THREE.Vector3(-Math.sin(eagle.yaw), 0, -Math.cos(eagle.yaw));
  const side = new THREE.Vector3(Math.cos(eagle.yaw), 0, -Math.sin(eagle.yaw));
  const desired = eagle.position.clone()
    .addScaledVector(back, mobile ? 26 : 20)
    .addScaledVector(side, mobile ? 2.6 : 3.2)
    .add(new THREE.Vector3(0, mobile ? 11 : 8.5, 0));
  desired.y = Math.max(desired.y, world.heightAt(desired.x, desired.z) + 2.2);
  if (immediate) camera.position.copy(desired);
  else camera.position.lerp(desired, Math.min(1, dt * 4.5));
  const lookAt = eagle.position.clone().add(new THREE.Vector3(Math.sin(eagle.yaw) * 19, 1.5, Math.cos(eagle.yaw) * 19));
  camera.lookAt(lookAt);
  const desiredFov = eagle.vision ? 39 : 61;
  camera.fov += (desiredFov - camera.fov) * Math.min(1, dt * 5);
  camera.updateProjectionMatrix();
}

function updateHud() {
  document.querySelector("#coins").textContent = `${profile.coins} 🪙`;
  document.querySelector("#stars").textContent = `${totalStars(profile)} ★`;
  document.querySelector("#focusBar").style.width = `${eagle.focus * 100}%`;
  document.querySelector("#altitude").textContent = `${Math.round(eagle.altitude)} м`;
  document.querySelector("#altitudeDot").style.bottom = `${THREE.MathUtils.clamp(eagle.altitude / 170, 0, 1) * 100}%`;
  const targetCard = document.querySelector("#targetCard");
  if (state.target && state.target.mode !== "gone") {
    const distance = Math.hypot(eagle.position.x - state.target.x, eagle.position.z - state.target.z);
    targetCard.innerHTML = `<strong>${state.target.definition.name}</strong><span>${Math.round(distance)} м · ${distance < 95 ? "готовь пике" : "держи курс"}</span>`;
    targetCard.classList.add("visible");
  } else targetCard.classList.remove("visible");

  const carryCard = document.querySelector("#carryCard");
  const homeBearing = document.querySelector("#homeBearing");
  if (eagle.carrying) {
    carryCard.innerHTML = `<strong>${ANIMALS[eagle.carrying].name} в когтях</strong><span>возвращайся к стоянке</span>`;
    carryCard.classList.add("visible");
    let angle = Math.atan2(-eagle.position.x, -eagle.position.z) - eagle.yaw;
    angle = Math.atan2(Math.sin(angle), Math.cos(angle));
    homeBearing.style.transform = `translateX(-50%) rotate(${angle}rad)`;
    homeBearing.classList.add("visible");
  } else {
    carryCard.classList.remove("visible");
    homeBearing.classList.remove("visible");
  }

  document.querySelector("#objective").textContent = eagle.carrying
    ? "Доставь добычу в круг у юрты"
    : state.target
      ? "Сблизься с целью и удерживай пике у самой земли"
      : eagle.vision
        ? "Коснись подсвеченной добычи, чтобы взять её в сопровождение"
        : "Включи зоркий глаз и найди добычу";
}

function updatePauseContent() {
  document.querySelector("#pauseTitle").textContent = gameLocation.name;
  const completed = profile.challenges[gameLocation.id] ?? {};
  document.querySelector("#challengeList").innerHTML = challengeList(gameLocation).map((item) => `
    <div class="challenge-row ${completed[item.id] ? "done" : ""}">
      <i>${completed[item.id] ? "★" : "○"}</i><span><strong>${item.name}</strong> — ${item.description}</span>
    </div>`).join("");
}

function setPaused(value) {
  paused = value;
  document.querySelector("#pausePanel").hidden = !paused;
  if (paused) {
    input.clearTransient();
    sound.wind(0);
    updatePauseContent();
  }
}

async function boot() {
  const featherTexturePromise = loadFeatherTexture().catch(() => null);
  world = await createGameWorld(scene, gameLocation, {
    mobile,
    onProgress: (value, note) => {
      loadingBar.style.width = `${Math.max(8, value * 100)}%`;
      loadingNote.textContent = note;
    },
  });
  const eagleModel = createEagle(await featherTexturePromise);
  eagle.model = eagleModel;
  scene.add(eagleModel);
  eagle.position.set(0, world.heightAt(0, -48) + 48, -48);
  eagle.altitude = 48;
  input = new InputController({ canvas, onTarget: pickTarget, onPause: () => setPaused(!paused) });
  document.querySelector("#menuButton").addEventListener("click", () => setPaused(true));
  document.querySelector("#continueButton").addEventListener("click", () => setPaused(false));
  document.addEventListener("visibilitychange", () => { if (document.hidden) setPaused(true); });
  addEventListener("pointerdown", () => sound.ensure(), { once: true });
  updatePauseContent();
  updateCamera(0, true);
  loading.classList.add("done");
  setTimeout(() => loading.remove(), 700);
  message("Левый стик управляет полётом. Зоркий глаз включается одним нажатием.", true);
  window.__bkOK = true;
  document.querySelector("#bk-diag")?.remove();
  window.__bkGame = { location: gameLocation.id, terrainSource: world.terrainSource, externalAnimalCount: world.externalAnimalCount, state };
  requestAnimationFrame(loop);
}

let previousTime = 0;
function loop(timestamp) {
  requestAnimationFrame(loop);
  if (!previousTime) previousTime = timestamp;
  const dt = Math.min(.05, (timestamp - previousTime) / 1000);
  previousTime = timestamp;
  if (!paused) {
    state.time += dt;
    if (state.hitFlash > 0) state.hitFlash -= dt;
    updateEagle(dt);
    world.update(dt, eagle);
    updateSightings();
    updateCamera(dt);
    sound.wind(Math.min(1, eagle.speed / 90));
  }
  renderer.render(scene, camera);
  drawOverlay(overlayContext, camera, world, state, viewWidth, viewHeight);
  updateHud();
}

boot().catch((error) => {
  console.error(error);
  loadingTitle.textContent = "Не удалось открыть маршрут";
  loadingNote.textContent = error.message;
  loadingBar.style.background = "#c96855";
  window.__bkFailedFast = true;
});
