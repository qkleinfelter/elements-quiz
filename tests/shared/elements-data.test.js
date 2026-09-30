import { describe, expect, it } from "vitest";
import { elements } from "../../src/shared/data/elements.js";

const VALID_DIFFICULTIES = ["easy", "medium", "hard"];
const VALID_STATUSES = ["obsolete", "deprecated", "non-standard", "removed", "still-valid"];

describe("elements data", () => {
  it("has no duplicate ids", () => {
    const ids = elements.map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(elements.map((el) => [el.id, el]))("%s has all required fields", (_id, el) => {
    expect(typeof el.tag).toBe("string");
    expect(el.tag.startsWith("<")).toBe(true);
    expect(Array.isArray(el.aliases)).toBe(true);
    expect(el.aliases.length).toBeGreaterThan(0);
    expect(typeof el.summary).toBe("string");
    expect(el.summary.length).toBeGreaterThan(0);
    expect(typeof el.origin).toBe("string");
    expect(el.origin.length).toBeGreaterThan(0);
    expect(el.replacement === null || typeof el.replacement === "string").toBe(true);
    expect(VALID_STATUSES).toContain(el.status);
    expect(VALID_DIFFICULTIES).toContain(el.difficulty);
    expect(typeof el.funFact).toBe("string");
    expect(el.funFact.length).toBeGreaterThan(0);
    expect(typeof el.source).toBe("string");
    expect(el.source.startsWith("https://")).toBe(true);
  });

  it("every alias normalizes to a lowercase, bracket-free string", () => {
    for (const el of elements) {
      for (const alias of el.aliases) {
        expect(alias).toBe(alias.toLowerCase());
        expect(alias).not.toMatch(/[<>]/);
      }
    }
  });

  it("has at least a handful of elements at every difficulty", () => {
    for (const difficulty of VALID_DIFFICULTIES) {
      const count = elements.filter((el) => el.difficulty === difficulty).length;
      expect(count).toBeGreaterThanOrEqual(4);
    }
  });
});
