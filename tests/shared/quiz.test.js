import { describe, expect, it } from "vitest";
import { elements } from "../../src/shared/data/elements.js";
import { poolForLevel } from "../../src/shared/pools.js";
import { buildRound, toPublicQuestion } from "../../src/shared/quiz.js";

describe("buildRound", () => {
  it("returns exactly the requested number of questions", () => {
    const round = buildRound({ elements, level: "easy", count: 10 });
    expect(round).toHaveLength(10);
  });

  it("returns more questions than the distinct pool by repeating sources", () => {
    const pool = poolForLevel(elements, "easy");
    const round = buildRound({ elements, level: "easy", count: 20 });
    expect(round).toHaveLength(20);
    expect(pool.length).toBeLessThan(20); // sanity check that repeats were actually needed
  });

  it('returns one question per distinct source for count "all"', () => {
    const pool = poolForLevel(elements, "medium");
    const round = buildRound({ elements, level: "medium", count: "all" });
    expect(round.length).toBeGreaterThanOrEqual(pool.length);
  });

  it("every question has a unique id", () => {
    const round = buildRound({ elements, level: "hard", count: 20 });
    const ids = new Set(round.map((q) => q.id));
    expect(ids.size).toBe(round.length);
  });

  it("every question matches the level's input mode", () => {
    const easyRound = buildRound({ elements, level: "easy", count: 10 });
    expect(easyRound.every((q) => q.mode === "choice")).toBe(true);

    const hardRound = buildRound({ elements, level: "hard", count: 10 });
    expect(hardRound.every((q) => q.mode === "text")).toBe(true);
  });
});

describe("toPublicQuestion", () => {
  it("strips answerIndex, acceptedAnswers, and explanation", () => {
    const [question] = buildRound({ elements, level: "easy", count: 1 });
    const publicQuestion = toPublicQuestion(question);
    expect(publicQuestion).not.toHaveProperty("answerIndex");
    expect(publicQuestion).not.toHaveProperty("acceptedAnswers");
    expect(publicQuestion).not.toHaveProperty("explanation");
    expect(publicQuestion.prompt).toBe(question.prompt);
    expect(publicQuestion.id).toBe(question.id);
  });
});
