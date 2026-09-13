import * as THREE from "../../three.module.js";
import { ANIMALS } from "../data/animals.js";
import { createRandom, pickWeighted, randomBetween, seedFromString } from "../core/random.js";
import { createAnimalModel, animateAnimal, createCamp, preloadAnimalModels } from "./models.js";
import { createLandmarks } from "./landmarks.js";
import { createTerrain, WORLD_HALF } from "./terrain.js";
import { createVegetation } from "./vegetation.js";

function randomSpawn(random, heightAt, near = null) {
  let x;
  let z;
  if (near) {
    const angle = random() * Math.PI * 2;
    const distance = randomBetween(random, 170, 430);
    x = near.x + Math.sin(angle) * distance;
    z = near.z + Math.cos(angle) * distance;
  } else {
    const angle = random() * Math.PI * 2;
    const distance = randomBetween(random, 140, WORLD_HALF - 65);
    x = Math.sin(angle) * distance;
    z = Math.cos(angle) * distance;
  }
  x = THREE.MathUtils.clamp(x, -WORLD_HALF + 30, WORLD_HALF - 30);
  z = THREE.MathUtils.clamp(z, -WORLD_HALF + 30, WORLD_HALF - 30);
  return new THREE.Vector3(x, heightAt(x, z), z);
}

function spawnAnimal({ location, random, heightAt, group, wildlife = false, near = null }) {
  let animalId = pickWeighted(random, location.wildlife, (id) => ANIMALS[id].kind === (wildlife ? "wildlife" : "prey"));
  if (!animalId) animalId = pickWeighted(random, location.wildlife, () => true);
  const definition = ANIMALS[animalId];
  const model = createAnimalModel(animalId);
  const point = randomSpawn(random, heightAt, near);
  model.position.copy(point);
  model.rotation.y = random() * Math.PI * 2;
  group.add(model);
  return {
    id: model.id,
    animalId,
    definition,
    model,
    x: point.x,
    z: point.z,
    direction: model.rotation.y,
    mode: "wander",
    timer: randomBetween(random, 1, 4),
    goneFor: 0,
  };
}

function disposeTree(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const item of materials) {
      item?.map?.dispose();
      item?.dispose();
    }
  });
}

function createClouds(random, mobile) {
  const group = new THREE.Group();
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 32, 3, 64, 32, 29);
  gradient.addColorStop(0, "rgba(255,255,255,.8)");
  gradient.addColorStop(.5, "rgba(244,246,240,.5)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 64);
  const texture = new THREE.CanvasTexture(canvas);
  const count = mobile ? 7 : 13;
  for (let index = 0; index < count; index += 1) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: randomBetween(random, .2, .46), depthWrite: false }));
    sprite.position.set(randomBetween(random, -800, 800), randomBetween(random, 180, 330), randomBetween(random, -800, 800));
    sprite.scale.set(randomBetween(random, 110, 240), randomBetween(random, 35, 75), 1);
    group.add(sprite);
  }
  return group;
}

export async function createGameWorld(scene, location, { mobile = false, onProgress } = {}) {
  const root = new THREE.Group();
  root.name = `world:${location.id}`;
  scene.add(root);
  onProgress?.(.04, "Читаем высоты SRTM");
  const animalModelsReady = preloadAnimalModels(Object.keys(location.wildlife));
  const terrain = await createTerrain(location, {
    mobile,
    onProgress: (value) => onProgress?.(.05 + value * .5, "Читаем высоты SRTM"),
  });
  root.add(terrain.mesh);
  onProgress?.(.6, "Высаживаем растительность");
  const vegetation = createVegetation(location, terrain.heightAt, { mobile });
  root.add(vegetation.group);
  onProgress?.(.72, "Восстанавливаем ориентиры");
  root.add(createLandmarks(location, terrain.heightAt));

  const camp = createCamp();
  camp.position.set(0, terrain.heightAt(0, 0), 0);
  root.add(camp);

  const random = createRandom(seedFromString(`${location.id}:animals`));
  root.add(createClouds(random, mobile));
  onProgress?.(.82, "Готовим животных");
  await animalModelsReady;
  const animals = [];
  const count = mobile ? 16 : 23;
  for (let index = 0; index < count; index += 1) {
    const wildlife = index < 2 || random() < .16;
    animals.push(spawnAnimal({ location, random, heightAt: terrain.heightAt, group: root, wildlife }));
  }
  onProgress?.(1, "Маршрут готов");

  const world = {
    root,
    location,
    heightAt: terrain.heightAt,
    terrainSource: terrain.source,
    animals,
    externalAnimalCount: animals.filter((animal) => Boolean(animal.model.userData.externalAnimation)).length,
    camp,
    colliders: [{ x: 0, z: 0, radius: 8, height: 6 }, ...vegetation.colliders],
    random,
    update(dt, eagle) {
      for (const animal of animals) {
        if (animal.mode === "gone") {
          animal.goneFor -= dt;
          if (animal.goneFor <= 0) {
            const point = randomSpawn(random, terrain.heightAt, eagle.position);
            animal.x = point.x;
            animal.z = point.z;
            animal.model.position.copy(point);
            animal.model.visible = true;
            animal.mode = "wander";
          }
          continue;
        }
        const distance = Math.hypot(eagle.position.x - animal.x, eagle.position.z - animal.z);
        animal.timer -= dt;
        if (distance < 62 && eagle.altitude < 42) {
          animal.mode = "flee";
          animal.timer = 2.8;
          animal.direction = Math.atan2(animal.x - eagle.position.x, animal.z - eagle.position.z) + randomBetween(random, -.35, .35);
        } else if (animal.timer <= 0) {
          animal.mode = "wander";
          animal.timer = randomBetween(random, 1.4, 4.2);
          animal.direction += randomBetween(random, -1.4, 1.4);
        }
        const movement = animal.mode === "flee" ? animal.definition.speed : animal.definition.speed * .18;
        animal.direction += (animal.mode === "flee" ? randomBetween(random, -.7, .7) : randomBetween(random, -.15, .15)) * dt;
        animal.x += Math.sin(animal.direction) * movement * dt;
        animal.z += Math.cos(animal.direction) * movement * dt;
        if (Math.abs(animal.x) > WORLD_HALF - 35 || Math.abs(animal.z) > WORLD_HALF - 35) animal.direction += Math.PI;
        animal.x = THREE.MathUtils.clamp(animal.x, -WORLD_HALF + 25, WORLD_HALF - 25);
        animal.z = THREE.MathUtils.clamp(animal.z, -WORLD_HALF + 25, WORLD_HALF - 25);
        animal.model.position.set(animal.x, terrain.heightAt(animal.x, animal.z), animal.z);
        animal.model.rotation.y = animal.direction;
        animateAnimal(animal.model, performance.now() / 1000, movement > 2);
      }
    },
    removeAnimal(animal, seconds = 8) {
      animal.mode = "gone";
      animal.goneFor = seconds;
      animal.model.visible = false;
    },
    dispose() {
      scene.remove(root);
      disposeTree(root);
    },
  };
  return world;
}
