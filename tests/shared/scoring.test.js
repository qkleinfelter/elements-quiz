import { describe, expect, it } from "vitest";
import { BASE_POINTS, LEVEL_MULTIPLIER, scoreAnswer, STREAK_BONUS, STREAK_THRESHOLD } from "../../shared/scoring.js";

describe("scoreAnswer", () => {
  it("awards 0 points and resets streak on an incorrect answer", () => {
    const result = scoreAnswer({
      correct: false,
      level: "easy",
      responseTimeMs: 1000,
      questionTimeMs: 30000,
      streakBeforeThisAnswer: 5,
    });
    expect(result).toEqual({ points: 0, streak: 0 });
  });

  it("awards full base points for an instant correct answer", () => {
    const result = scoreAnswer({
      correct: true,
      level: "easy",
      responseTimeMs: 0,
      questionTimeMs: 30000,
      streakBeforeThisAnswer: 0,
    });
    expect(result.points).toBe(BASE_POINTS * LEVEL_MULTIPLIER.easy);
    expect(result.streak).toBe(1);
  });

  it("awards half base points for an answer at the very last moment", () => {
    const result = scoreAnswer({
      correct: true,
      level: "easy",
      responseTimeMs: 30000,
      questionTimeMs: 30000,
      streakBeforeThisAnswer: 0,
    });
    expect(result.points).toBe(Math.round(BASE_POINTS * LEVEL_MULTIPLIER.easy * 0.5));
  });

  it("clamps response times beyond the question time to the minimum (half points)", () => {
    const result = scoreAnswer({
      correct: true,
      level: "easy",
      responseTimeMs: 999999,
      questionTimeMs: 30000,
      streakBeforeThisAnswer: 0,
    });
    expect(result.points).toBe(Math.round(BASE_POINTS * LEVEL_MULTIPLIER.easy * 0.5));
  });

  it("scales base points by the level multiplier", () => {
    const easy = scoreAnswer({ correct: true, level: "easy", responseTimeMs: 0, questionTimeMs: 30000, streakBeforeThisAnswer: 0 });
    const hard = scoreAnswer({ correct: true, level: "hard", responseTimeMs: 0, questionTimeMs: 30000, streakBeforeThisAnswer: 0 });
    expect(hard.points).toBeGreaterThan(easy.points);
    expect(hard.points).toBe(BASE_POINTS * LEVEL_MULTIPLIER.hard);
  });

  it("adds a streak bonus once the streak reaches the threshold", () => {
    const result = scoreAnswer({
      correct: true,
      level: "easy",
      responseTimeMs: 0,
      questionTimeMs: 30000,
      streakBeforeThisAnswer: STREAK_THRESHOLD - 1,
    });
    expect(result.streak).toBe(STREAK_THRESHOLD);
    expect(result.points).toBe(BASE_POINTS * LEVEL_MULTIPLIER.easy + STREAK_BONUS);
  });

  it("does not add a streak bonus below the threshold", () => {
    const result = scoreAnswer({
      correct: true,
      level: "easy",
      responseTimeMs: 0,
      questionTimeMs: 30000,
      streakBeforeThisAnswer: STREAK_THRESHOLD - 2,
    });
    expect(result.points).toBe(BASE_POINTS * LEVEL_MULTIPLIER.easy);
  });

  it("throws on an unknown level", () => {
    expect(() =>
      scoreAnswer({ correct: true, level: "extreme", responseTimeMs: 0, questionTimeMs: 30000, streakBeforeThisAnswer: 0 }),
    ).toThrow();
  });
});
