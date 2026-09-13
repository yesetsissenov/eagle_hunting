import { describe, expect, it } from "vitest";
import { getLocation } from "../src/data/locations.js";
import {
  applyDelivery,
  buyUpgrade,
  catchReward,
  evaluateChallenges,
  locationUnlocked,
  totalStars,
  upgradeCost,
} from "../src/core/progression.js";
import { defaultProfile } from "../src/core/storage.js";

describe("progression and economy", () => {
  it("unlocks routes with mastery stars instead of charging entry fees", () => {
    const profile = defaultProfile();
    expect(locationUnlocked(getLocation("saryarka"), profile)).toBe(true);
    expect(locationUnlocked(getLocation("burabay"), profile)).toBe(false);
    profile.challenges.saryarka = { scout: true, precision: true };
    expect(totalStars(profile)).toBe(2);
    expect(locationUnlocked(getLocation("burabay"), profile)).toBe(true);
  });

  it("awards discovery once and never rewards protected wildlife", () => {
    const location = getLocation("saryarka");
    expect(catchReward("fieldMouse", location, { firstDiscovery: true }))
      .toBe(catchReward("fieldMouse", location) + 60);
    expect(catchReward("saiga", location, { firstDiscovery: true })).toBe(0);
  });

  it("evaluates all three transparent challenge conditions", () => {
    const location = getLocation("saryarka");
    const result = evaluateChallenges(location, {
      spottedSpecies: new Set(["a", "b", "c", "d"]),
      catchWasDive: true,
      catchSpeed: 60,
      deliverySeconds: 80,
      collisions: 0,
    });
    expect(result).toEqual({ scout: true, precision: true, return: true });
  });

  it("does not pay a challenge twice", () => {
    const location = getLocation("saryarka");
    const run = {
      spottedSpecies: new Set(["a", "b", "c", "d"]), catchWasDive: true,
      catchSpeed: 60, deliverySeconds: 80, collisions: 0,
    };
    const first = applyDelivery(defaultProfile(), { animalId: "fieldMouse", location, run });
    const second = applyDelivery(first.profile, { animalId: "fieldMouse", location, run });
    expect(first.newlyCompleted).toHaveLength(3);
    expect(second.newlyCompleted).toHaveLength(0);
    expect(second.challengeCoins).toBe(0);
  });

  it("never removes mastery earned on an earlier run", () => {
    const location = getLocation("saryarka");
    const profile = defaultProfile();
    profile.challenges.saryarka = { scout: true, precision: true, return: true };
    const result = applyDelivery(profile, {
      animalId: "fieldMouse",
      location,
      run: { spottedSpecies: new Set(), catchWasDive: false, catchSpeed: 20, deliverySeconds: 999, collisions: 4 },
    });
    expect(result.profile.challenges.saryarka).toEqual({ scout: true, precision: true, return: true });
  });

  it("uses predictable upgrade prices and respects the balance", () => {
    const profile = { ...defaultProfile(), coins: 500 };
    expect(upgradeCost("vision", 0)).toBe(130);
    const result = buyUpgrade(profile, "vision");
    expect(result.ok).toBe(true);
    expect(result.profile.upgrades.vision).toBe(1);
    expect(result.profile.coins).toBe(370);
  });
});
