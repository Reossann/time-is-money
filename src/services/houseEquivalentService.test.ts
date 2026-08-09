import { describe, expect, it } from "vitest";

import { HOUSE_UNIT_YEN } from "../constants/houseEquivalent";
import { HOUSE_EQUIVALENT_FIXTURES } from "../test/fixtures/houseEquivalent";
import type { HouseEquivalentInput } from "../types/houseEquivalent";
import {
  calculateHouseEquivalent,
  getHouseConstructionStage,
  HouseEquivalentError,
} from "./houseEquivalentService";

describe("calculateHouseEquivalent", () => {
  it("keeps zero earned amount at the foundation stage", () => {
    expect(calculateHouseEquivalent(HOUSE_EQUIVALENT_FIXTURES.zero)).toEqual({
      unitYen: HOUSE_UNIT_YEN,
      earnedYen: 0,
      wastedYen: 0,
      completedHouseCount: 0,
      currentHouseProgress: 0,
      currentHouseProgressPercent: 0,
      remainingYenToNextHouse: HOUSE_UNIT_YEN,
      constructionStage: "foundation",
      wastedHouseEquivalentCount: 0,
    });
  });

  it("starts a new house at zero percent after exactly one completed house", () => {
    expect(calculateHouseEquivalent(HOUSE_EQUIVALENT_FIXTURES.oneUnit)).toMatchObject({
      completedHouseCount: 1,
      currentHouseProgress: 0,
      currentHouseProgressPercent: 0,
      remainingYenToNextHouse: HOUSE_UNIT_YEN,
      constructionStage: "foundation",
    });
  });

  it("calculates completed houses independently from wasted money", () => {
    const result = calculateHouseEquivalent(
      HOUSE_EQUIVALENT_FIXTURES.multipleWithProgress,
    );

    expect(result).toMatchObject({
      completedHouseCount: 3,
      currentHouseProgress: 0.5,
      currentHouseProgressPercent: 50,
      remainingYenToNextHouse: HOUSE_UNIT_YEN / 2,
      constructionStage: "walls",
      wastedHouseEquivalentCount: 2,
    });
  });

  it("uses all construction-stage boundaries", () => {
    expect(getHouseConstructionStage(0)).toBe("foundation");
    expect(getHouseConstructionStage(19)).toBe("foundation");
    expect(getHouseConstructionStage(20)).toBe("frame");
    expect(getHouseConstructionStage(44)).toBe("frame");
    expect(getHouseConstructionStage(45)).toBe("walls");
    expect(getHouseConstructionStage(69)).toBe("walls");
    expect(getHouseConstructionStage(70)).toBe("roof");
    expect(getHouseConstructionStage(89)).toBe("roof");
    expect(getHouseConstructionStage(90)).toBe("finishing");
    expect(getHouseConstructionStage(99)).toBe("finishing");
  });

  it("keeps the progress below one immediately before the next house", () => {
    const result = calculateHouseEquivalent({
      earnedYen: HOUSE_UNIT_YEN - 1,
      wastedYen: 0,
    });

    expect(result).toMatchObject({
      completedHouseCount: 0,
      currentHouseProgressPercent: 99,
      remainingYenToNextHouse: 1,
      constructionStage: "finishing",
    });
    expect(result.currentHouseProgress).toBeLessThan(1);
  });

  it("accepts safe-integer lifetime amounts", () => {
    const result = calculateHouseEquivalent({
      earnedYen: Number.MAX_SAFE_INTEGER,
      wastedYen: Number.MAX_SAFE_INTEGER,
    });

    expect(result.earnedYen).toBe(Number.MAX_SAFE_INTEGER);
    expect(result.wastedYen).toBe(Number.MAX_SAFE_INTEGER);
    expect(Number.isSafeInteger(result.completedHouseCount)).toBe(true);
    expect(Number.isSafeInteger(result.remainingYenToNextHouse)).toBe(true);
  });

  it.each([
    ["earnedYen", { earnedYen: -1, wastedYen: 0 }, "INVALID_EARNED_YEN"],
    ["wastedYen", { earnedYen: 0, wastedYen: 0.5 }, "INVALID_WASTED_YEN"],
    ["unitYen", { earnedYen: 0, wastedYen: 0, unitYen: 0 }, "INVALID_UNIT_YEN"],
    [
      "unsafe earnedYen",
      { earnedYen: Number.MAX_SAFE_INTEGER + 1, wastedYen: 0 },
      "INVALID_EARNED_YEN",
    ],
  ] as const)("rejects invalid %s", (_label, input, code) => {
    expect(() =>
      calculateHouseEquivalent(input as HouseEquivalentInput),
    ).toThrow(expect.objectContaining({ code }));
  });

  it("returns an immutable result without changing the input", () => {
    const input = Object.freeze({
      earnedYen: HOUSE_UNIT_YEN / 5,
      wastedYen: HOUSE_UNIT_YEN,
    });

    const result = calculateHouseEquivalent(input);

    expect(Object.isFrozen(result)).toBe(true);
    expect(input).toEqual({
      earnedYen: HOUSE_UNIT_YEN / 5,
      wastedYen: HOUSE_UNIT_YEN,
    });
  });
});

describe("HouseEquivalentError", () => {
  it("keeps its error code", () => {
    const error = new HouseEquivalentError(
      "INVALID_UNIT_YEN",
      "invalid unit",
    );

    expect(error).toMatchObject({ code: "INVALID_UNIT_YEN" });
  });
});
