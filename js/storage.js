const prefix = "jarvis2050.";

export function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(prefix + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    window.dispatchEvent(new CustomEvent("jarvis-storage-error", { detail: { operation: "read", key, error } }));
    return fallback;
  }
}

export function writeStore(key, value) {
  try {
    localStorage.setItem(prefix + key, JSON.stringify(value));
    return true;
  } catch (error) {
    window.dispatchEvent(new CustomEvent("jarvis-storage-error", { detail: { operation: "save", key, error } }));
    return false;
  }
}

export function clearStore() {
  try {
    Object.keys(localStorage).filter((key) => key.startsWith(prefix)).forEach((key) => localStorage.removeItem(key));
    return true;
  } catch (error) {
    window.dispatchEvent(new CustomEvent("jarvis-storage-error", { detail: { operation: "clear", key: "all", error } }));
    return false;
  }
}
