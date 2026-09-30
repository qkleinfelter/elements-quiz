import { describe, expect, it } from "vitest";
import { isCorrectTypedAnswer, normalizeAnswer } from "../../shared/answerMatch.js";

describe("normalizeAnswer", () => {
  it("lowercases and trims", () => {
    expect(normalizeAnswer("  Marquee  ")).toBe("marquee");
  });

  it("strips surrounding angle brackets", () => {
    expect(normalizeAnswer("<marquee>")).toBe("marquee");
  });

  it("strips angle brackets with internal whitespace", () => {
    expect(normalizeAnswer("< Frame >")).toBe("frame");
  });

  it("collapses repeated whitespace", () => {
    expect(normalizeAnswer("rate    limit")).toBe("rate limit");
  });

  it("returns an empty string for non-string input", () => {
    expect(normalizeAnswer(undefined)).toBe("");
    expect(normalizeAnswer(null)).toBe("");
    expect(normalizeAnswer(42)).toBe("");
  });
});

describe("isCorrectTypedAnswer", () => {
  const accepted = ["frame", "frameset"];

  it("matches an exact alias", () => {
    expect(isCorrectTypedAnswer("frame", accepted)).toBe(true);
  });

  it("matches case-insensitively and with brackets", () => {
    expect(isCorrectTypedAnswer("<FRAMESET>", accepted)).toBe(true);
  });

  it("matches with surrounding whitespace", () => {
    expect(isCorrectTypedAnswer("   frame   ", accepted)).toBe(true);
  });

  it("rejects an unrelated answer", () => {
    expect(isCorrectTypedAnswer("marquee", accepted)).toBe(false);
  });

  it("rejects an empty answer", () => {
    expect(isCorrectTypedAnswer("", accepted)).toBe(false);
    expect(isCorrectTypedAnswer("   ", accepted)).toBe(false);
  });
});
