import { readStore, writeStore, clearStore } from "./storage.js";

const defaults = { theme: "dark", accent: "cyan", soundEffects: false, voiceOutput: true, voiceURI: "", animationIntensity: "standard", clockFormat: "24" };
const accents = {
  cyan: ["#55dcff", "85, 220, 255"], violet: ["#b28bff", "178, 139, 255"],
  blue: ["#6e9bff", "110, 155, 255"], green: ["#68e6b2", "104, 230, 178"]
};
let settings = { ...defaults, ...readStore("settings", {}) };

export function getSettings() { return { ...settings }; }

export function applySettings() {
  document.body.classList.toggle("light-theme", settings.theme === "light");
  const [hex, rgb] = accents[settings.accent] || accents.cyan;
  document.documentElement.style.setProperty("--accent", hex);
  document.documentElement.style.setProperty("--accent-rgb", rgb);
  document.documentElement.dataset.animationIntensity = settings.animationIntensity;
}

export function updateSetting(key, value) {
  if (!Object.hasOwn(defaults, key)) return false;
  if (key === "theme" && !["dark", "light"].includes(value)) return false;
  if (key === "accent" && !Object.hasOwn(accents, value)) return false;
  if (key === "animationIntensity" && !["reduced", "standard", "high"].includes(value)) return false;
  if (key === "clockFormat" && !["12", "24"].includes(value)) return false;
  if (["soundEffects", "voiceOutput"].includes(key) && typeof value !== "boolean") return false;
  if (key === "voiceURI" && typeof value !== "string") return false;
  settings = { ...settings, [key]: value };
  applySettings();
  return writeStore("settings", settings);
}

export function resetAll() {
  if (!clearStore()) return false;
  settings = { ...defaults };
  applySettings();
  return true;
}

export function resetSettings() {
  settings = { ...defaults };
  applySettings();
  return writeStore("settings", settings);
}
