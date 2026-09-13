import { describe, expect, it } from "vitest";
import { ANIMALS } from "../src/data/animals.js";
import { LOCATIONS, LOCATION_BY_ID } from "../src/data/locations.js";
import { challengeList } from "../src/core/progression.js";

describe("game content", () => {
  it("contains fifteen distinct real-world locations", () => {
    expect(LOCATIONS).toHaveLength(15);
    expect(new Set(LOCATIONS.map((location) => location.id)).size).toBe(15);
    expect(Object.keys(LOCATION_BY_ID)).toHaveLength(15);
  });

  it("uses a valid animal table and progressive unlock thresholds", () => {
    let previousStars = -1;
    for (const location of LOCATIONS) {
      expect(location.unlockStars).toBeGreaterThan(previousStars);
      previousStars = location.unlockStars;
      expect(location.coordinates).toHaveLength(2);
      expect(location.tile).toHaveLength(2);
      expect(Object.keys(location.wildlife).length).toBeGreaterThanOrEqual(6);
      for (const animalId of Object.keys(location.wildlife)) expect(ANIMALS[animalId]).toBeTruthy();
      expect(challengeList(location)).toHaveLength(3);
    }
  });

  it("separates huntable prey from protected ambient wildlife", () => {
    const kinds = new Set(Object.values(ANIMALS).map((animal) => animal.kind));
    expect(kinds).toEqual(new Set(["prey", "wildlife"]));
    expect(Object.values(ANIMALS).filter((animal) => animal.kind === "prey").length).toBeGreaterThanOrEqual(20);
    expect(Object.values(ANIMALS).filter((animal) => animal.kind === "wildlife").length).toBeGreaterThanOrEqual(8);
  });
});
