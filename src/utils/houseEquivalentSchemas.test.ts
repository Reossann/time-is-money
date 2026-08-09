import { describe, expect, it } from "vitest";

import {
  houseEquivalentInputSchema,
  houseEquivalentSchema,
} from "./houseEquivalentSchemas";

const validInput = {
  earnedYen: 30_000_000,
  wastedYen: 10_000_000,
} as const;

describe("houseEquivalentInputSchema", () => {
  it("accepts whole non-negative JPY amounts", () => {
    expect(houseEquivalentInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects unknown, fractional, and negative input fields", () => {
    expect(
      houseEquivalentInputSchema.safeParse({ ...validInput, extra: true })
        .success,
    ).toBe(false);
    expect(
      houseEquivalentInputSchema.safeParse({ ...validInput, earnedYen: 0.5 })
        .success,
    ).toBe(false);
    expect(
      houseEquivalentInputSchema.safeParse({ ...validInput, wastedYen: -1 })
        .success,
    ).toBe(false);
  });
});

describe("houseEquivalentSchema", () => {
  it("accepts a complete conversion result", () => {
    expect(
      houseEquivalentSchema.safeParse({
        unitYen: 30_000_000,
        earnedYen: 30_000_000,
        wastedYen: 10_000_000,
        completedHouseCount: 1,
        currentHouseProgress: 0,
        currentHouseProgressPercent: 0,
        remainingYenToNextHouse: 30_000_000,
        constructionStage: "foundation",
        wastedHouseEquivalentCount: 0,
      }).success,
    ).toBe(true);
  });

  it("rejects a completed current house", () => {
    expect(
      houseEquivalentSchema.safeParse({
        unitYen: 30_000_000,
        earnedYen: 30_000_000,
        wastedYen: 0,
        completedHouseCount: 1,
        currentHouseProgress: 1,
        currentHouseProgressPercent: 100,
        remainingYenToNextHouse: 0,
        constructionStage: "finishing",
        wastedHouseEquivalentCount: 0,
      }).success,
    ).toBe(false);
  });
});
