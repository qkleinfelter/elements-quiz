// Live-mode scoring shared by Solo and Live so the rules never drift between modes
// (see PLAN.md §5, §7). Solo calls this directly; the Live GameRoom Durable Object is
// the only caller in multiplayer games, since responseTime must be measured server-side.

export const LEVEL_MULTIPLIER = Object.freeze({ easy: 1, medium: 1.5, hard: 2 });
export const BASE_POINTS = 1000;
export const STREAK_BONUS = 50;
export const STREAK_THRESHOLD = 3;

/**
 * Scores a single answer.
 *
 * @param {object} params
 * @param {boolean} params.correct - Whether the answer was correct.
 * @param {"easy"|"medium"|"hard"} params.level
 * @param {number} params.responseTimeMs - Time taken to answer, in milliseconds.
 * @param {number} params.questionTimeMs - Total time allowed for the question, in milliseconds.
 * @param {number} params.streakBeforeThisAnswer - Correct-answer streak going into this question.
 * @returns {{ points: number, streak: number }}
 */
export function scoreAnswer({ correct, level, responseTimeMs, questionTimeMs, streakBeforeThisAnswer }) {
  if (!correct) {
    return { points: 0, streak: 0 };
  }
  const multiplier = LEVEL_MULTIPLIER[level];
  if (multiplier === undefined) {
    throw new Error(`Unknown level: ${level}`);
  }
  const ratio = questionTimeMs > 0 ? responseTimeMs / questionTimeMs : 1;
  const clampedRatio = Math.min(Math.max(ratio, 0), 1);
  const basePoints = BASE_POINTS * multiplier;
  const speedPoints = Math.round(basePoints * (1 - clampedRatio / 2));
  const newStreak = streakBeforeThisAnswer + 1;
  const streakBonus = newStreak >= STREAK_THRESHOLD ? STREAK_BONUS : 0;
  return { points: speedPoints + streakBonus, streak: newStreak };
}
