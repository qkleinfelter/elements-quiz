import { describe, expect, it } from "vitest";
import { inputModeForLevel, LEVELS, poolForLevel } from "../../src/shared/pools.js";

const elements = [
  { id: "a", difficulty: "easy" },
  { id: "b", difficulty: "medium" },
  { id: "c", difficulty: "hard" },
];

describe("poolForLevel", () => {
  it("easy pool contains only easy elements", () => {
    expect(poolForLevel(elements, "easy").map((e) => e.id)).toEqual(["a"]);
  });

  it("medium pool contains easy and medium elements", () => {
    expect(poolForLevel(elements, "medium").map((e) => e.id).sort()).toEqual(["a", "b"]);
  });

  it("hard pool contains medium and hard elements", () => {
    expect(poolForLevel(elements, "hard").map((e) => e.id).sort()).toEqual(["b", "c"]);
  });

  it("throws on an unknown level", () => {
    expect(() => poolForLevel(elements, "extreme")).toThrow();
  });
});

describe("inputModeForLevel", () => {
  it("easy and medium are choice mode", () => {
    expect(inputModeForLevel("easy")).toBe("choice");
    expect(inputModeForLevel("medium")).toBe("choice");
  });

  it("hard is text mode", () => {
    expect(inputModeForLevel("hard")).toBe("text");
  });
});

describe("LEVELS", () => {
  it("is easy, medium, hard in order", () => {
    expect(LEVELS).toEqual(["easy", "medium", "hard"]);
  });
});
