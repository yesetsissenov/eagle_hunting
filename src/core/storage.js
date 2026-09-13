export const PROFILE_KEY = "berkutchi_profile_v4";

export function defaultProfile() {
  return {
    version: 4,
    coins: 0,
    selectedLocation: "saryarka",
    collection: {},
    sightings: {},
    challenges: {},
    upgrades: { vision: 0, handling: 0, endurance: 0 },
    stats: { deliveries: 0, bestDive: 0 },
  };
}

const LEGACY_LOCATION_MAP = {
  steppe: "saryarka",
  kaiyndy: "kaindy",
};

const LEGACY_ANIMAL_MAP = {
  mouse: "fieldMouse",
  hamster: "dwarfHamster",
  suslik: "suslik",
  rabbit: "tolaiHare",
  hare: "tolaiHare",
  marmot: "marmot",
  partridge: "chukar",
  pheasant: "pheasant",
  korsak: "korsak",
  fox: "redFox",
  badger: "badger",
  wolfcub: "redFox",
};

function migrateCollection(collection) {
  const migrated = {};
  for (const [legacyId, count] of Object.entries(asRecord(collection))) {
    const id = LEGACY_ANIMAL_MAP[legacyId] ?? legacyId;
    migrated[id] = (migrated[id] ?? 0) + Math.max(0, Math.floor(Number(count) || 0));
  }
  return migrated;
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function normalizeProfile(value) {
  const base = defaultProfile();
  const profile = asRecord(value);
  return {
    ...base,
    ...profile,
    version: 4,
    coins: Math.max(0, Math.floor(Number(profile.coins) || 0)),
    selectedLocation: String(profile.selectedLocation || base.selectedLocation),
    collection: asRecord(profile.collection),
    sightings: asRecord(profile.sightings),
    challenges: asRecord(profile.challenges),
    upgrades: { ...base.upgrades, ...asRecord(profile.upgrades) },
    stats: { ...base.stats, ...asRecord(profile.stats) },
  };
}

export function loadProfile(storage = globalThis.localStorage) {
  try {
    const saved = storage.getItem(PROFILE_KEY);
    if (saved) return normalizeProfile(JSON.parse(saved));

    const legacyCoins = Number(storage.getItem("eagle_coins")) || 0;
    const legacyCollection = migrateCollection(JSON.parse(storage.getItem("eagle_coll") || "{}"));
    const legacyLocation = storage.getItem("eagle_loc") || "steppe";
    const migrated = normalizeProfile({
      coins: legacyCoins,
      collection: legacyCollection,
      selectedLocation: LEGACY_LOCATION_MAP[legacyLocation] ?? legacyLocation,
    });
    saveProfile(migrated, storage);
    return migrated;
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(profile, storage = globalThis.localStorage) {
  const normalized = normalizeProfile(profile);
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify(normalized));
  } catch {
    // Private browsing can deny storage; the current session still works.
  }
  return normalized;
}

export function updateProfile(mutator, storage = globalThis.localStorage) {
  const next = mutator(loadProfile(storage));
  return saveProfile(next, storage);
}
