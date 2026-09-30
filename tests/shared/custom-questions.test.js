import { describe, expect, it } from "vitest";
import { customQuestions, customQuestionsForLevel } from "../../src/shared/data/custom-questions.js";

describe("customQuestionsForLevel", () => {
  it("never returns a question whose mode doesn't match the level's input mode", () => {
    for (const level of ["easy", "medium", "hard"]) {
      const expectedMode = level === "hard" ? "text" : "choice";
      for (const question of customQuestionsForLevel(level)) {
        expect(question.mode).toBe(expectedMode);
      }
    }
  });

  it("only returns questions whose own mode is choice for easy/medium", () => {
    for (const question of customQuestionsForLevel("easy")) expect(question.mode).toBe("choice");
    for (const question of customQuestionsForLevel("medium")) expect(question.mode).toBe("choice");
  });

  it("includes the text-mode custom question only at hard level", () => {
    const textQuestions = customQuestions.filter((q) => q.mode === "text");
    expect(textQuestions.length).toBeGreaterThan(0);
    expect(customQuestionsForLevel("hard")).toEqual(expect.arrayContaining(textQuestions));
    expect(customQuestionsForLevel("easy")).not.toEqual(expect.arrayContaining(textQuestions));
    expect(customQuestionsForLevel("medium")).not.toEqual(expect.arrayContaining(textQuestions));
  });
});
