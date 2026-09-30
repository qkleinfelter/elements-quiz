import { describe, expect, it } from "vitest";
import { elements } from "../../src/shared/data/elements.js";
import { poolForLevel } from "../../src/shared/pools.js";
import {
  buildQuestion,
  identifySpecimen,
  nameTheTag,
  whatDidItDo,
  whatOrigin,
  whatReplacedIt,
} from "../../src/shared/questionTypes.js";

const easyPool = poolForLevel(elements, "easy");
const hardPool = poolForLevel(elements, "hard");

function expectValidChoiceQuestion(question) {
  expect(question.mode).toBe("choice");
  expect(question.choices).toHaveLength(4);
  expect(new Set(question.choices).size).toBe(4); // all unique
  expect(question.answerIndex).toBeGreaterThanOrEqual(0);
  expect(question.answerIndex).toBeLessThan(4);
  expect(typeof question.explanation).toBe("string");
  expect(question.explanation.length).toBeGreaterThan(0);
}

describe("whatDidItDo", () => {
  it("produces a valid choice question with the element's summary as the answer", () => {
    for (const el of easyPool) {
      const question = whatDidItDo(el, easyPool);
      expectValidChoiceQuestion(question);
      expect(question.choices[question.answerIndex]).toBe(el.summary);
    }
  });
});

describe("whatOrigin", () => {
  it("produces a valid choice question with the element's origin as the answer", () => {
    for (const el of easyPool) {
      const question = whatOrigin(el, easyPool);
      expectValidChoiceQuestion(question);
      expect(question.choices[question.answerIndex]).toBe(el.origin);
    }
  });
});

describe("whatReplacedIt", () => {
  it("produces a valid choice question when the element has a replacement", () => {
    const withReplacement = hardPool.filter((el) => el.replacement);
    for (const el of withReplacement) {
      const question = whatReplacedIt(el, hardPool);
      expectValidChoiceQuestion(question);
      expect(question.choices[question.answerIndex]).toBe(el.replacement);
    }
  });

  it("returns null for a still-valid element with no replacement", () => {
    const stillValid = elements.find((el) => el.replacement === null);
    expect(whatReplacedIt(stillValid, elements)).toBeNull();
  });
});

describe("nameTheTag", () => {
  it("in choice mode, produces a valid choice question with the element's tag as the answer", () => {
    for (const el of easyPool) {
      const question = nameTheTag(el, easyPool, "choice");
      expectValidChoiceQuestion(question);
      expect(question.choices[question.answerIndex]).toBe(el.tag);
    }
  });

  it("in text mode, produces a text question whose acceptedAnswers match the element's aliases", () => {
    for (const el of hardPool) {
      const question = nameTheTag(el, hardPool, "text");
      expect(question.mode).toBe("text");
      expect(question.acceptedAnswers).toEqual(el.aliases);
      expect(question.acceptedAnswers.length).toBeGreaterThan(0);
    }
  });
});

describe("identifySpecimen", () => {
  it("returns null for an element with no demo", () => {
    const noDemo = elements.find((el) => !el.demo);
    expect(identifySpecimen(noDemo, elements, "choice")).toBeNull();
  });

  it("produces a valid choice question with a demo for an element that has one", () => {
    const withDemo = elements.filter((el) => el.demo);
    for (const el of withDemo) {
      const question = identifySpecimen(el, elements, "choice");
      expectValidChoiceQuestion(question);
      expect(question.demo).toBe(el.demo);
    }
  });

  it("produces a text question with acceptedAnswers in text mode", () => {
    const withDemo = elements.find((el) => el.demo);
    const question = identifySpecimen(withDemo, elements, "text");
    expect(question.mode).toBe("text");
    expect(question.acceptedAnswers).toEqual(withDemo.aliases);
  });
});

describe("buildQuestion", () => {
  it("always returns a question matching the requested mode, for every element in the bank", () => {
    for (const el of elements) {
      const choicePool = poolForLevel(elements, el.difficulty === "easy" ? "easy" : el.difficulty === "hard" ? "hard" : "medium");
      const choiceQuestion = buildQuestion(el, choicePool, "choice");
      expect(choiceQuestion.mode).toBe("choice");
      expectValidChoiceQuestion(choiceQuestion);

      const textQuestion = buildQuestion(el, choicePool, "text");
      expect(textQuestion.mode).toBe("text");
      expect(textQuestion.acceptedAnswers.length).toBeGreaterThan(0);
    }
  });
});
