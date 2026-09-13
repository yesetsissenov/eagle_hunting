import { ANIMALS } from "../data/animals.js";
import { LOCATIONS } from "../data/locations.js";
import { loadProfile, saveProfile } from "../core/storage.js";
import { buyUpgrade, challengeList, totalStars, UPGRADE_DEFINITIONS, upgradeCost } from "../core/progression.js";

let profile = loadProfile();

function render() {
  document.querySelector("#wallet").textContent = `${profile.coins} 🪙 · ${totalStars(profile)} ★`;
  renderUpgrades();
  renderAnimals();
  renderMastery();
}

function renderUpgrades() {
  document.querySelector("#upgradeGrid").innerHTML = Object.entries(UPGRADE_DEFINITIONS).map(([id, upgrade]) => {
    const level = profile.upgrades[id] ?? 0;
    const cost = upgradeCost(id, level);
    const pips = Array.from({ length: upgrade.maxLevel }, (_, index) => `<i class="${index < level ? "active" : ""}"></i>`).join("");
    return `<article class="upgrade-card">
      <h3>${upgrade.name}</h3><p>${upgrade.description}</p>
      <div class="level-pips">${pips}</div>
      <button class="button ${cost === null ? "secondary" : "primary"}" data-upgrade="${id}" ${cost === null ? "disabled" : ""}>
        ${cost === null ? "Максимальная выучка" : `${cost} 🪙 · улучшить`}
      </button>
    </article>`;
  }).join("");
}

function renderAnimals() {
  document.querySelector("#animalGrid").innerHTML = Object.entries(ANIMALS).map(([id, animal]) => {
    const count = profile.collection[id] ?? 0;
    const seen = count > 0 || (profile.sightings[id] ?? 0) > 0;
    const revealed = seen || animal.kind === "wildlife";
    return `<article class="animal-card ${revealed ? "" : "unknown"}">
      <span class="animal-icon">${revealed ? animal.icon : "◌"}</span>
      ${count ? `<span class="count">×${count}</span>` : ""}
      <h3>${revealed ? animal.name : "Неизвестный вид"}</h3>
      <p>${revealed ? animal.kk : "Найди его зорким глазом"}</p>
      ${animal.kind === "wildlife" ? '<span class="protected">ТОЛЬКО НАБЛЮДЕНИЕ</span>' : ""}
    </article>`;
  }).join("");
}

function renderMastery() {
  document.querySelector("#masteryGrid").innerHTML = LOCATIONS.map((location) => {
    const completed = profile.challenges[location.id] ?? {};
    const rows = challengeList(location).map((item) => `<div class="challenge-row ${completed[item.id] ? "done" : ""}"><i>${completed[item.id] ? "★" : "○"}</i><span><strong>${item.name}</strong> — ${item.description}</span></div>`).join("");
    return `<article class="mastery-card"><h3>${location.name}</h3>${rows}</article>`;
  }).join("");
}

document.querySelector("#upgradeGrid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-upgrade]");
  if (!button) return;
  const result = buyUpgrade(profile, button.dataset.upgrade);
  if (!result.ok) {
    button.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }],
      { duration: 200 },
    );
    return;
  }
  profile = saveProfile(result.profile);
  render();
});

render();
