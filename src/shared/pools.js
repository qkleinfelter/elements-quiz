// Level -> input mode and eligible element pool, per PLAN.md §3.
export const LEVELS = ["easy", "medium", "hard"];

const POOL_DIFFICULTIES = {
  easy: ["easy"],
  medium: ["easy", "medium"],
  hard: ["medium", "hard"],
};

const INPUT_MODES = {
  easy: "choice",
  medium: "choice",
  hard: "text",
};

export function assertLevel(level) {
  if (!LEVELS.includes(level)) {
    throw new Error(`Unknown level: ${level}`);
  }
}

/** The input mode ("choice" | "text") a given level uses. */
export function inputModeForLevel(level) {
  assertLevel(level);
  return INPUT_MODES[level];
}

/** Elements eligible to be asked about at a given level. */
export function poolForLevel(elements, level) {
  assertLevel(level);
  const difficulties = POOL_DIFFICULTIES[level];
  return elements.filter((el) => difficulties.includes(el.difficulty));
}
