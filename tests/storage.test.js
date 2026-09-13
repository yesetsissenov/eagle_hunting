import { describe, expect, it } from "vitest";
import { loadProfile, PROFILE_KEY, saveProfile } from "../src/core/storage.js";

function memoryStorage(entries = {}) {
  const data = new Map(Object.entries(entries));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
  };
}

describe("profile storage", () => {
  it("migrates legacy progress without losing coins and trophies", () => {
    const storage = memoryStorage({
      eagle_coins: "240",
      eagle_loc: "kaiyndy",
      eagle_coll: JSON.stringify({ fox: 3 }),
    });
    const profile = loadProfile(storage);
    expect(profile.coins).toBe(240);
    expect(profile.selectedLocation).toBe("kaindy");
    expect(profile.collection.redFox).toBe(3);
    expect(storage.getItem(PROFILE_KEY)).toBeTruthy();
  });

  it("normalizes malformed numeric data", () => {
    const storage = memoryStorage();
    const saved = saveProfile({ coins: -10, upgrades: null }, storage);
    expect(saved.coins).toBe(0);
    expect(saved.upgrades.vision).toBe(0);
  });
});
