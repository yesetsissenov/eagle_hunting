import { ANIMALS } from "../data/animals.js";

export const UPGRADE_DEFINITIONS = {
  vision: { name: "Зоркий глаз", description: "+25% к запасу концентрации", baseCost: 130, maxLevel: 4 },
  handling: { name: "Выучка", description: "Беркут быстрее входит в поворот", baseCost: 150, maxLevel: 4 },
  endurance: { name: "Выносливость", description: "Выше крейсерская скорость", baseCost: 170, maxLevel: 4 },
};

export const CHALLENGE_REWARDS = {
  scout: 90,
  precision: 130,
  return: 170,
};

export function totalStars(profile) {
  return Object.values(profile.challenges ?? {}).reduce(
    (sum, challenges) => sum + Object.values(challenges).filter(Boolean).length,
    0,
  );
}

export function locationUnlocked(location, profile) {
  return totalStars(profile) >= location.unlockStars;
}

export function challengeList(location) {
  return [
    {
      id: "scout",
      name: "Следопыт",
      description: `обнаружить ${location.challenge.scout} разных зверей зорким глазом`,
    },
    {
      id: "precision",
      name: "Точное пике",
      description: `захватить добычу в пике на скорости ${location.challenge.diveSpeed}+`,
    },
    {
      id: "return",
      name: "Чистое возвращение",
      description: `доставить добычу за ${location.challenge.returnSeconds} сек. без столкновений`,
    },
  ];
}

export function evaluateChallenges(location, run) {
  return {
    scout: (run.spottedSpecies?.size ?? run.spottedSpecies?.length ?? 0) >= location.challenge.scout,
    precision: run.catchWasDive === true && run.catchSpeed >= location.challenge.diveSpeed,
    return: run.deliverySeconds <= location.challenge.returnSeconds && run.collisions === 0,
  };
}

export function catchReward(animalId, location, { firstDiscovery = false } = {}) {
  const animal = ANIMALS[animalId];
  if (!animal || animal.kind !== "prey") return 0;
  return Math.round(animal.reward * location.rewardMultiplier) + (firstDiscovery ? 60 : 0);
}

export function upgradeCost(id, level) {
  const upgrade = UPGRADE_DEFINITIONS[id];
  if (!upgrade || level >= upgrade.maxLevel) return null;
  return Math.round(upgrade.baseCost * (1 + level * 0.75));
}

export function buyUpgrade(profile, id) {
  const upgrade = UPGRADE_DEFINITIONS[id];
  if (!upgrade) return { ok: false, reason: "unknown" };
  const level = profile.upgrades?.[id] ?? 0;
  const cost = upgradeCost(id, level);
  if (cost === null) return { ok: false, reason: "max" };
  if (profile.coins < cost) return { ok: false, reason: "coins", cost };
  return {
    ok: true,
    profile: {
      ...profile,
      coins: profile.coins - cost,
      upgrades: { ...profile.upgrades, [id]: level + 1 },
    },
    cost,
  };
}

export function applyDelivery(profile, { animalId, location, run }) {
  const previousCount = profile.collection?.[animalId] ?? 0;
  const reward = catchReward(animalId, location, { firstDiscovery: previousCount === 0 });
  const results = evaluateChallenges(location, run);
  const previousChallenges = profile.challenges?.[location.id] ?? {};
  const newlyCompleted = Object.entries(results)
    .filter(([id, passed]) => passed && !previousChallenges[id])
    .map(([id]) => id);
  const challengeCoins = newlyCompleted.reduce((sum, id) => sum + CHALLENGE_REWARDS[id], 0);
  const combinedChallenges = Object.fromEntries(
    Object.keys(results).map((id) => [id, Boolean(previousChallenges[id] || results[id])]),
  );

  return {
    profile: {
      ...profile,
      coins: profile.coins + reward + challengeCoins,
      collection: { ...profile.collection, [animalId]: previousCount + 1 },
      challenges: {
        ...profile.challenges,
        [location.id]: combinedChallenges,
      },
      stats: {
        ...profile.stats,
        deliveries: (profile.stats?.deliveries ?? 0) + 1,
        bestDive: Math.max(profile.stats?.bestDive ?? 0, Math.round(run.catchSpeed ?? 0)),
      },
    },
    reward,
    challengeCoins,
    newlyCompleted,
    firstDiscovery: previousCount === 0,
  };
}

export function mainGoalComplete(profile) {
  const finale = profile.challenges?.bozzhyra ?? {};
  return ["scout", "precision", "return"].every((id) => finale[id]);
}
