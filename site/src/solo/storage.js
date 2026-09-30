const HIGH_SCORE_KEY_PREFIX = "elements-quiz:high-score:";
const SETTINGS_KEY = "elements-quiz:settings";

function getStore() {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    // localStorage can throw in some privacy-locked-down browser contexts.
  }
  return null;
}

// In-memory fallback so the app still works (without persistence) if localStorage
// is unavailable, and so tests don't need a DOM/localStorage polyfill.
const memoryStore = new Map();

function readRaw(key) {
  const store = getStore();
  if (store) return store.getItem(key);
  return memoryStore.has(key) ? memoryStore.get(key) : null;
}

function writeRaw(key, value) {
  const store = getStore();
  if (store) {
    store.setItem(key, value);
    return;
  }
  memoryStore.set(key, value);
}

/** Returns the saved high score for a level, or 0 if none is saved. */
export function getHighScore(level) {
  const raw = readRaw(HIGH_SCORE_KEY_PREFIX + level);
  const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Saves `score` as the high score for a level if it beats the current one. Returns the new high score. */
export function maybeSaveHighScore(level, score) {
  const current = getHighScore(level);
  if (score > current) {
    writeRaw(HIGH_SCORE_KEY_PREFIX + level, String(score));
    return score;
  }
  return current;
}

const DEFAULT_SETTINGS = Object.freeze({ level: "easy", questionCount: 10, timerSeconds: 30 });

/** Returns the saved settings (level, questionCount, timerSeconds), falling back to defaults. */
export function getSettings() {
  const raw = readRaw(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persists a partial settings update, merged with the current settings. */
export function saveSettings(partialSettings) {
  const merged = { ...getSettings(), ...partialSettings };
  writeRaw(SETTINGS_KEY, JSON.stringify(merged));
  return merged;
}
