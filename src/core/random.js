export function seedFromString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomBetween(random, min, max) {
  return min + random() * (max - min);
}

export function pickWeighted(random, weights, predicate = () => true) {
  const entries = Object.entries(weights).filter(([id, weight]) => weight > 0 && predicate(id));
  const sum = entries.reduce((total, [, weight]) => total + weight, 0);
  let cursor = random() * sum;
  for (const [id, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) return id;
  }
  return entries.at(-1)?.[0] ?? null;
}
