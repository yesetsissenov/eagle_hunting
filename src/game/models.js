import * as THREE from "../../three.module.js";
import { ANIMALS } from "../data/animals.js";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { clone as cloneSkeleton } from "../vendor/SkeletonUtils.js";

const externalLoader = new GLTFLoader();
const externalTemplates = new Map();
const EXTERNAL_MODELS = {
  fieldMouse: "rat",
  dwarfHamster: "rat",
  waterVole: "rat",
  marmot: "marmot",
  korsak: "fox",
  redFox: "fox",
  mallard: "duck",
  ibex: "goat",
  argali: "goat",
};

async function loadExternalModel(key) {
  if (externalTemplates.has(key)) return externalTemplates.get(key);
  const promise = externalLoader.loadAsync(new URL(`../../assets/models/${key}.glb`, import.meta.url).href)
    .then((gltf) => ({ scene: gltf.scene, animations: gltf.animations }));
  externalTemplates.set(key, promise);
  const template = await promise;
  externalTemplates.set(key, template);
  return template;
}

export async function preloadAnimalModels(ids) {
  const keys = [...new Set(ids.map((id) => EXTERNAL_MODELS[id]).filter(Boolean))];
  await Promise.all(keys.map((key) => loadExternalModel(key).catch(() => {
    externalTemplates.delete(key);
    return null;
  })));
}

function createExternalAnimal(id, animal) {
  const key = EXTERNAL_MODELS[id];
  const cached = key && externalTemplates.get(key);
  if (!cached || typeof cached.then === "function") return null;
  const asset = cloneSkeleton(cached.scene);
  const box = new THREE.Box3().setFromObject(asset);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const normalizedHeight = key === "duck" ? 1.8 : 2.2;
  const modelScale = normalizedHeight / Math.max(size.y, .001);
  asset.scale.multiplyScalar(modelScale);
  asset.position.set(-center.x * modelScale, -box.min.y * modelScale, -center.z * modelScale);

  const group = new THREE.Group();
  group.add(asset);
  const mixer = new THREE.AnimationMixer(asset);
  const idleClip = THREE.AnimationClip.findByName(cached.animations, "idle")
    ?? THREE.AnimationClip.findByName(cached.animations, "Survey")
    ?? cached.animations[0];
  const walkClip = THREE.AnimationClip.findByName(cached.animations, "walk")
    ?? THREE.AnimationClip.findByName(cached.animations, "Walk")
    ?? THREE.AnimationClip.findByName(cached.animations, "Run")
    ?? idleClip;
  group.userData.externalAnimation = {
    mixer,
    idle: idleClip ? mixer.clipAction(idleClip) : null,
    walk: walkClip ? mixer.clipAction(walkClip) : null,
    active: null,
    lastTime: null,
  };
  group.scale.multiplyScalar(animal.size);
  return group;
}

function standard(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, ...options });
}

function ellipsoid(color, scale, position = [0, 0, 0], detail = 14) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, detail, Math.max(8, detail - 4)), standard(color));
  mesh.scale.set(...scale);
  mesh.position.set(...position);
  return mesh;
}

function limb(color, radiusTop, radiusBottom, length, position, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 8), standard(color));
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  return mesh;
}

function cone(color, radius, length, position, rotation = [0, 0, 0], segments = 8) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, length, segments), standard(color));
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  return mesh;
}

function addEyes(group, y, z, spread, size = 0.045, color = 0x11130f) {
  for (const side of [-1, 1]) {
    const eye = ellipsoid(color, [size, size, size * 0.55], [side * spread, y, z], 8);
    group.add(eye);
  }
}

function featherGeometry(length, width) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(length * .22, width * .65, length * .7, width * .55, length, 0);
  shape.bezierCurveTo(length * .72, -width * .5, length * .22, -width * .58, 0, 0);
  const geometry = new THREE.ShapeGeometry(shape, 8);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function createWing(side, lightMaterial, darkMaterial) {
  const wing = new THREE.Group();
  const covertsShape = new THREE.Shape();
  covertsShape.moveTo(0, .45);
  covertsShape.quadraticCurveTo(2.4, 1.15, 4.3, .28);
  covertsShape.quadraticCurveTo(3.2, -.72, .2, -.5);
  const covertsGeometry = new THREE.ShapeGeometry(covertsShape, 14);
  covertsGeometry.rotateX(-Math.PI / 2);
  const coverts = new THREE.Mesh(covertsGeometry, lightMaterial);
  coverts.position.z = .1;
  wing.add(coverts);

  const secondaries = [];
  for (let index = 0; index < 8; index += 1) {
    const feather = new THREE.Mesh(featherGeometry(2.05 - index * .07, .34), index < 3 ? lightMaterial : darkMaterial);
    feather.position.set(.7 + index * .39, -.04 - index * .025, -.28 - index * .16);
    feather.rotation.y = -.08 - index * .035;
    feather.rotation.z = -.03 * index;
    wing.add(feather);
    secondaries.push(feather);
  }
  wing.scale.x = side;
  wing.userData.feathers = secondaries;
  return wing;
}

export function createEagle(featherTexture = null) {
  const group = new THREE.Group();
  group.name = "golden-eagle";
  const bodyMaterial = standard(0x382a20);
  const goldenMaterial = standard(0x9b7138);
  const darkFeatherMaterial = standard(0x2e241e, { side: THREE.DoubleSide, map: featherTexture });
  const lightFeatherMaterial = standard(0x725031, { side: THREE.DoubleSide, map: featherTexture });

  const body = ellipsoid(0x4a3527, [.64, .57, 1.58], [0, 0, 0]);
  const chest = ellipsoid(0x604329, [.6, .56, .86], [0, -.02, .7]);
  const neck = ellipsoid(0x9b7138, [.43, .44, .62], [0, .1, 1.42]);
  const head = ellipsoid(0x6f512c, [.36, .34, .46], [0, .16, 1.92]);
  const brow = ellipsoid(0x3b2b1e, [.34, .18, .24], [0, .25, 2.12], 10);
  const beakBase = cone(0xd0aa35, .17, .48, [0, .08, 2.35], [Math.PI / 2, 0, 0], 9);
  const beakTip = cone(0x332817, .1, .3, [0, -.02, 2.58], [Math.PI / 2 + .45, 0, 0], 8);
  group.add(body, chest, neck, head, brow, beakBase, beakTip);
  addEyes(group, .23, 2.23, .24, .055, 0xe4bf4a);
  addEyes(group, .235, 2.265, .241, .024, 0x0b0b08);

  const mantle = new THREE.Group();
  for (let row = 0; row < 5; row += 1) {
    const count = 3 + row;
    for (let index = 0; index < count; index += 1) {
      const offset = index - (count - 1) / 2;
      const feather = new THREE.Mesh(
        featherGeometry(.55 + row * .08, .2),
        row < 2 ? goldenMaterial : (row % 2 ? lightFeatherMaterial : darkFeatherMaterial),
      );
      feather.position.set(offset * .16, .5 - row * .025, 1.2 - row * .38);
      feather.rotation.y = -Math.PI / 2 + offset * .035;
      feather.rotation.z = offset * .025;
      mantle.add(feather);
    }
  }
  group.add(mantle);

  const leftWing = createWing(-1, lightFeatherMaterial, darkFeatherMaterial);
  const rightWing = createWing(1, lightFeatherMaterial, darkFeatherMaterial);
  leftWing.position.set(-.35, .06, .25);
  rightWing.position.set(.35, .06, .25);
  group.add(leftWing, rightWing);

  const tail = new THREE.Group();
  for (let index = -3; index <= 3; index += 1) {
    const feather = new THREE.Mesh(featherGeometry(1.8 - Math.abs(index) * .09, .3), standard(index % 2 ? 0x4f3b2c : 0x2f271f, { side: THREE.DoubleSide, map: featherTexture }));
    feather.position.set(index * .17, -.06, -1.35);
    feather.rotation.set(-Math.PI / 2, Math.PI / 2 + index * .035, 0);
    tail.add(feather);
  }
  group.add(tail);

  const legs = [];
  for (const side of [-1, 1]) {
    const leg = limb(0xc6a137, .055, .075, .55, [side * .28, -.55, .45], [0, 0, side * .12]);
    const foot = new THREE.Group();
    foot.position.set(side * .29, -.85, .55);
    for (let toe = -1; toe <= 1; toe += 1) {
      const talon = cone(0x27221a, .035, .34, [toe * .09, 0, .12], [Math.PI / 2 + .25, 0, 0], 6);
      foot.add(talon);
    }
    group.add(leg, foot);
    legs.push(leg, foot);
  }

  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  group.userData.parts = { leftWing, rightWing, tail, legs, mantle, bodyMaterial, goldenMaterial };
  group.userData.animate = ({ time, diving = false, speed = 40 }) => {
    const frequency = diving ? 3.2 : 6.5 + Math.min(4, speed * .035);
    const amplitude = diving ? .08 : .48;
    const flap = Math.sin(time * frequency) * amplitude;
    leftWing.rotation.z = diving ? 1.02 : flap - .06;
    rightWing.rotation.z = diving ? -1.02 : -flap + .06;
    tail.rotation.y = Math.sin(time * 1.7) * .06;
    for (const feather of [...leftWing.userData.feathers, ...rightWing.userData.feathers]) feather.rotation.z += Math.sin(time * 4 + feather.position.x) * .002;
  };
  group.scale.setScalar(1.02);
  return group;
}

function createHare(animal) {
  const [bodyColor, detailColor, darkColor] = animal.colors;
  const group = new THREE.Group();
  const body = ellipsoid(bodyColor, [.63, .68, 1.05], [0, .72, 0]);
  const chest = ellipsoid(detailColor, [.44, .52, .55], [0, .72, .65]);
  const head = ellipsoid(bodyColor, [.43, .48, .5], [0, 1.25, .83]);
  const legs = [
    ellipsoid(bodyColor, [.3, .25, .63], [-.34, .35, -.45]),
    ellipsoid(bodyColor, [.3, .25, .63], [.34, .35, -.45]),
    limb(bodyColor, .1, .13, .56, [-.28, .38, .75], [0, 0, 0]),
    limb(bodyColor, .1, .13, .56, [.28, .38, .75], [0, 0, 0]),
  ];
  for (const side of [-1, 1]) {
    const ear = ellipsoid(bodyColor, [.14, .6, .13], [side * .2, 2.05, .78], 10);
    const inner = ellipsoid(0xba8b87, [.06, .43, .035], [side * .2, 2.08, .88], 8);
    group.add(ear, inner);
  }
  const tail = ellipsoid(detailColor, [.25, .25, .25], [0, .78, -1.02], 10);
  group.add(body, chest, head, ...legs, tail);
  addEyes(group, 1.4, 1.22, .32, .05, darkColor);
  group.userData.parts = { legs, tail, body };
  return group;
}

function createRodent(animal, id) {
  const [bodyColor, detailColor, darkColor] = animal.colors;
  const group = new THREE.Group();
  const stout = id === "marmot";
  const body = ellipsoid(bodyColor, [stout ? .75 : .55, stout ? .72 : .5, stout ? 1.05 : .78], [0, stout ? .7 : .48, 0]);
  const head = ellipsoid(bodyColor, [stout ? .52 : .4, stout ? .48 : .36, .46], [0, stout ? 1.15 : .82, .7]);
  const belly = ellipsoid(detailColor, [.37, .34, .48], [0, stout ? .66 : .44, .55]);
  const legs = [];
  for (const side of [-1, 1]) {
    for (const z of [-.45, .48]) {
      const leg = limb(darkColor, .07, .09, .32, [side * .34, .2, z], [0, 0, side * .15]);
      group.add(leg);
      legs.push(leg);
    }
    const ear = ellipsoid(detailColor, [.13, .17, .08], [side * .26, stout ? 1.48 : 1.12, .72], 8);
    group.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.TorusGeometry(stout ? .24 : .46, .045, 6, 18, Math.PI * 1.3), standard(bodyColor));
  tail.position.set(0, stout ? .58 : .4, -.72);
  tail.rotation.set(Math.PI / 2, 0, -.7);
  group.add(body, head, belly, ...legs, tail);
  addEyes(group, stout ? 1.28 : .94, 1.02, .3, .045, darkColor);
  group.userData.parts = { legs, tail, body };
  return group;
}

function createJerboa(animal) {
  const group = createRodent(animal, "jerboa");
  const [bodyColor] = animal.colors;
  const hindLegs = [];
  for (const side of [-1, 1]) {
    const leg = limb(bodyColor, .09, .12, .9, [side * .3, .38, -.38], [1.15, 0, side * .12]);
    group.add(leg);
    hindLegs.push(leg);
  }
  group.scale.set(.8, .8, .8);
  group.userData.parts.legs.push(...hindLegs);
  return group;
}

function createSquirrel(animal) {
  const group = createRodent(animal, "squirrel");
  const tail = new THREE.Group();
  for (let index = 0; index < 5; index += 1) {
    tail.add(ellipsoid(animal.colors[0], [.28 + index * .04, .28 + index * .04, .44], [0, .25 + index * .27, -index * .16], 10));
  }
  tail.position.set(0, .45, -.65);
  tail.rotation.x = -.35;
  group.add(tail);
  group.userData.parts.tail = tail;
  return group;
}

function createCanid(animal) {
  const [bodyColor, detailColor, darkColor] = animal.colors;
  const group = new THREE.Group();
  const body = ellipsoid(bodyColor, [.62, .68, 1.35], [0, .9, 0]);
  const chest = ellipsoid(detailColor, [.48, .7, .58], [0, .92, .86]);
  const neck = ellipsoid(bodyColor, [.43, .63, .55], [0, 1.26, .84]);
  const head = ellipsoid(bodyColor, [.45, .45, .52], [0, 1.63, 1.22]);
  const muzzle = ellipsoid(detailColor, [.3, .24, .58], [0, 1.53, 1.65]);
  const nose = ellipsoid(darkColor, [.15, .12, .13], [0, 1.56, 2.06], 8);
  const legs = [];
  for (const side of [-1, 1]) {
    for (const z of [-.72, .72]) {
      const leg = limb(bodyColor, .11, .14, .9, [side * .4, .43, z], [0, 0, side * .035]);
      group.add(leg);
      legs.push(leg);
    }
    const ear = cone(bodyColor, .22, .58, [side * .27, 2.1, 1.22], [0, 0, side * -.12], 7);
    group.add(ear);
  }
  const tail = new THREE.Group();
  for (let index = 0; index < 5; index += 1) {
    tail.add(ellipsoid(index === 4 ? detailColor : bodyColor, [.25 - index * .018, .22 - index * .012, .48], [0, 0, -index * .38], 10));
  }
  tail.position.set(0, 1.05, -1.15);
  tail.rotation.x = -.62;
  group.add(body, chest, neck, head, muzzle, nose, ...legs, tail);
  addEyes(group, 1.75, 1.64, .34, .05, darkColor);
  group.userData.parts = { legs, tail, body };
  return group;
}

function createMustelid(animal, id) {
  const [bodyColor, detailColor, darkColor] = animal.colors;
  const group = new THREE.Group();
  const body = ellipsoid(bodyColor, [.62, .46, 1.42], [0, .55, 0]);
  const neck = ellipsoid(bodyColor, [.42, .4, .66], [0, .68, .95]);
  const head = ellipsoid(detailColor, [.4, .36, .52], [0, .75, 1.38]);
  const muzzle = ellipsoid(detailColor, [.27, .21, .42], [0, .68, 1.78]);
  const nose = ellipsoid(darkColor, [.12, .1, .1], [0, .69, 2.07], 8);
  const legs = [];
  for (const side of [-1, 1]) {
    for (const z of [-.75, .78]) {
      const leg = limb(darkColor, .09, .12, .46, [side * .37, .25, z]);
      group.add(leg);
      legs.push(leg);
    }
    if (id === "badger") {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(.1, .42, .55), standard(darkColor));
      stripe.position.set(side * .2, .85, 1.52);
      stripe.rotation.z = side * .18;
      group.add(stripe);
    }
  }
  const tail = cone(bodyColor, .27, .95, [0, .64, -1.45], [-Math.PI / 2, 0, 0], 10);
  group.add(body, neck, head, muzzle, nose, ...legs, tail);
  addEyes(group, .86, 1.7, .3, .045, darkColor);
  group.userData.parts = { legs, tail, body };
  return group;
}

function createBird(animal, waterbird = false) {
  const [bodyColor, detailColor, darkColor] = animal.colors;
  const group = new THREE.Group();
  const body = ellipsoid(bodyColor, [.48, .58, .9], [0, .72, 0]);
  const breast = ellipsoid(detailColor, [.38, .46, .5], [0, .7, .56]);
  const neck = ellipsoid(bodyColor, [.25, waterbird ? .48 : .3, .27], [0, waterbird ? 1.25 : 1.1, .58]);
  const head = ellipsoid(bodyColor, [.3, .31, .35], [0, waterbird ? 1.6 : 1.38, .66]);
  const beak = cone(0xd49a35, .1, waterbird ? .62 : .4, [0, waterbird ? 1.56 : 1.34, waterbird ? 1.12 : 1.02], [Math.PI / 2, 0, 0], 7);
  const wings = [];
  for (const side of [-1, 1]) {
    const wing = ellipsoid(darkColor, [.1, .42, .68], [side * .46, .78, -.04], 10);
    wing.rotation.z = side * -.18;
    group.add(wing);
    wings.push(wing);
    const leg = limb(0x8d6634, .045, .055, .48, [side * .18, .25, .18]);
    group.add(leg);
  }
  const tail = cone(darkColor, .34, .95, [0, .66, -.92], [-Math.PI / 2, 0, 0], 8);
  group.add(body, breast, neck, head, beak, ...wings, tail);
  addEyes(group, waterbird ? 1.68 : 1.46, waterbird ? .91 : .9, .24, .035, 0x111111);
  group.userData.parts = { legs: [], tail, wings, body };
  return group;
}

function createUngulate(animal, id) {
  const [bodyColor, detailColor, darkColor] = animal.colors;
  const group = new THREE.Group();
  const body = ellipsoid(bodyColor, [.72, .78, 1.55], [0, 1.35, 0]);
  const chest = ellipsoid(detailColor, [.63, .75, .62], [0, 1.38, .94]);
  const neck = limb(bodyColor, .3, .42, 1.2, [0, 1.95, 1.03], [-.28, 0, 0]);
  const head = ellipsoid(bodyColor, [.42, .42, .68], [0, 2.46, 1.38]);
  const muzzle = ellipsoid(detailColor, [.3, .28, .45], [0, 2.34, 1.9]);
  const legs = [];
  for (const side of [-1, 1]) {
    for (const z of [-.82, .8]) {
      const leg = limb(bodyColor, .1, .14, 1.45, [side * .45, .62, z]);
      const hoof = ellipsoid(darkColor, [.15, .12, .25], [side * .45, -.07, z + .08]);
      group.add(leg, hoof);
      legs.push(leg);
    }
    const ear = cone(bodyColor, .18, .52, [side * .31, 2.9, 1.38], [0, 0, side * -.25], 7);
    group.add(ear);
    if (["ibex", "argali", "maral"].includes(id)) {
      const horn = new THREE.Mesh(new THREE.TorusGeometry(id === "argali" ? .42 : .3, .05, 7, 22, Math.PI * 1.35), standard(0x594a38));
      horn.position.set(side * .28, 2.82, 1.34);
      horn.rotation.y = side * Math.PI / 2;
      horn.rotation.z = side * -.25;
      group.add(horn);
    }
  }
  const tail = cone(darkColor, .15, .5, [0, 1.45, -1.45], [-Math.PI / 2, 0, 0], 7);
  group.add(body, chest, neck, head, muzzle, ...legs, tail);
  addEyes(group, 2.56, 1.83, .34, .045, darkColor);
  group.userData.parts = { legs, tail, body };
  return group;
}

function createWader(animal) {
  const group = createBird(animal, true);
  group.scale.set(.9, 1.2, .9);
  return group;
}

function createFeline(animal) {
  const group = createCanid(animal);
  group.scale.set(1.05, .86, 1.08);
  const spotMaterial = standard(animal.colors[2]);
  for (let index = 0; index < 18; index += 1) {
    const spot = new THREE.Mesh(new THREE.SphereGeometry(.07, 6, 5), spotMaterial);
    const angle = index * 2.4;
    spot.position.set(Math.sin(angle) * .62, .88 + Math.sin(index * 1.7) * .34, -1 + (index % 6) * .4);
    group.add(spot);
  }
  return group;
}

export function createAnimalModel(id) {
  const animal = ANIMALS[id];
  if (!animal) throw new Error(`Unknown animal: ${id}`);
  let group = createExternalAnimal(id, animal);
  const external = Boolean(group);
  if (!group) {
    if (animal.family === "hare") group = createHare(animal);
    else if (animal.family === "jerboa") group = createJerboa(animal);
    else if (animal.family === "squirrel") group = createSquirrel(animal);
    else if (["rodent", "marmot"].includes(animal.family)) group = createRodent(animal, id);
    else if (animal.family === "canid") group = createCanid(animal);
    else if (animal.family === "mustelid") group = createMustelid(animal, id);
    else if (animal.family === "bird") group = createBird(animal, false);
    else if (animal.family === "waterbird") group = createBird(animal, true);
    else if (animal.family === "ungulate") group = createUngulate(animal, id);
    else if (animal.family === "wader") group = createWader(animal);
    else if (animal.family === "feline") group = createFeline(animal);
    else group = createRodent(animal, id);
  }
  group.name = id;
  if (!external) group.scale.multiplyScalar(animal.size);
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return group;
}

export function animateAnimal(model, time, moving = true) {
  const external = model.userData.externalAnimation;
  if (external) {
    const next = moving ? external.walk : external.idle;
    if (next && next !== external.active) {
      external.active?.fadeOut(.18);
      next.reset().fadeIn(.18).play();
      external.active = next;
    }
    const dt = external.lastTime === null ? 0 : THREE.MathUtils.clamp(time - external.lastTime, 0, .05);
    external.lastTime = time;
    external.mixer.update(dt);
    return;
  }
  const parts = model.userData.parts;
  if (!parts) return;
  const gait = moving ? Math.sin(time * 8 + model.id) : 0;
  parts.legs?.forEach((leg, index) => { leg.rotation.x = gait * .32 * (index % 2 ? -1 : 1); });
  if (parts.tail) parts.tail.rotation.y = Math.sin(time * 3 + model.id) * .18;
  parts.wings?.forEach((wing, index) => { wing.rotation.z = (index ? -1 : 1) * Math.abs(Math.sin(time * 5)) * .16; });
  if (parts.body) {
    if (parts.body.userData.restY === undefined) parts.body.userData.restY = parts.body.position.y;
    parts.body.position.y = parts.body.userData.restY + Math.abs(gait) * .045;
  }
}

export function createCamp() {
  const group = new THREE.Group();
  group.name = "camp";
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.1, 3.2, 28), standard(0xe1dac8));
  wall.position.y = 1.6;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.1, 2.3, 28), standard(0xd1c4aa));
  roof.position.y = 4.35;
  const shanyrak = new THREE.Mesh(new THREE.TorusGeometry(.85, .12, 7, 24), standard(0x9b5534));
  shanyrak.rotation.x = Math.PI / 2;
  shanyrak.position.y = 5.55;
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.45, 2.25, .18), standard(0x88462f));
  door.position.set(0, 1.35, 5);
  group.add(wall, roof, shanyrak, door);

  const hunter = new THREE.Group();
  hunter.position.set(-7, 0, 2.5);
  const coat = new THREE.Mesh(new THREE.CylinderGeometry(.75, 1.05, 2.9, 14), standard(0x74352d));
  coat.position.y = 1.6;
  const head = ellipsoid(0xc99568, [.46, .5, .46], [0, 3.55, 0]);
  const hat = cone(0x4a3325, .72, 1.25, [0, 4.35, 0], [0, 0, 0], 12);
  const arm = limb(0x74352d, .16, .2, 1.8, [.72, 2.45, .15], [0, 0, -.85]);
  hunter.add(coat, head, hat, arm);
  group.add(hunter);

  const beacon = new THREE.Mesh(new THREE.RingGeometry(6.5, 7, 48), new THREE.MeshBasicMaterial({ color: 0xe2bd68, side: THREE.DoubleSide, transparent: true, opacity: .42 }));
  beacon.rotation.x = -Math.PI / 2;
  beacon.position.y = .12;
  group.add(beacon);
  group.traverse((child) => { if (child.isMesh) child.castShadow = true; });
  return group;
}
