import { LOCATIONS } from "../data/locations.js";
import { loadProfile, saveProfile } from "../core/storage.js";
import { locationUnlocked, mainGoalComplete, totalStars } from "../core/progression.js";

const profile = loadProfile();
const stars = totalStars(profile);
const caughtSpecies = Object.values(profile.collection).filter((count) => count > 0).length;
const finished = mainGoalComplete(profile);

document.querySelector("#goalCard").innerHTML = `
  <p class="eyebrow">ГЛАВНАЯ ЦЕЛЬ</p>
  <strong>${finished ? "Путь мастера завершён" : "Доберись до Бозжыры"}</strong>
  <p>${finished ? "Ты прошёл три финальных испытания Бозжыры." : "Собери 30 знаков мастерства, открой Бозжыру и пройди её три испытания."}</p>
  <div class="progress-track"><i style="width:${Math.min(100, stars / 33 * 100)}%"></i></div>`;

document.querySelector("#statsStrip").innerHTML = [
  [stars, "знаков мастерства"],
  [profile.coins, "монет на выучку"],
  [caughtSpecies, "видов в коллекции"],
  [profile.stats.deliveries, "успешных охот"],
].map(([value, label]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");

const grid = document.querySelector("#locationGrid");
grid.innerHTML = LOCATIONS.map((location) => {
  const unlocked = locationUnlocked(location, profile);
  const completed = Object.values(profile.challenges[location.id] ?? {}).filter(Boolean).length;
  const colors = location.palette;
  const background = `linear-gradient(145deg, #${colors.sky.toString(16).padStart(6, "0")}, #${colors.ground.toString(16).padStart(6, "0")})`;
  const tag = unlocked ? `${completed}/3 ★` : `Нужно ${location.unlockStars} ★`;
  return `<a class="location-card ${unlocked ? "" : "locked"}" ${unlocked ? `href="./game.html?location=${location.id}"` : 'aria-disabled="true"'} data-location="${location.id}" style="--card-background:${background}">
    <div class="landscape-mark"></div>
    <span class="location-lock">${tag}</span>
    <div class="location-content">
      <div class="location-meta"><span>${location.kk}</span><span>${location.region}</span></div>
      <h3>${location.name}</h3>
      <p>${location.signature}</p>
    </div>
  </a>`;
}).join("");

grid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-location]");
  if (!card || card.getAttribute("aria-disabled") === "true") {
    event.preventDefault();
    card?.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }],
      { duration: 220 },
    );
    return;
  }
  profile.selectedLocation = card.dataset.location;
  saveProfile(profile);
});
