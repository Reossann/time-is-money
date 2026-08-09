import { describe, expect, it } from "vitest";

import {
  MONEY_ANIMATION_MAX_PARTICLE_COUNT,
  MONEY_ANIMATION_MIN_PARTICLE_COUNT,
} from "../constants/moneyAnimation";
import { MONEY_ANIMATION_FIXTURES } from "../test/fixtures/moneyAnimation";
import type { MoneyAnimationMode } from "../types/moneyAnimation";
import {
  amountToVisualCount,
  createMoneyAnimationDisplayModel,
  formatMoneyAnimationAmount,
  MoneyAnimationError,
  validateMoneyAnimationInput,
} from "./moneyAnimationService";

describe("MoneyAnimation display model", () => {
  it.each(MONEY_ANIMATION_FIXTURES)(
    "keeps $id as an exact whole-JPY text value",
    ({ amountYen, mode }) => {
      const model = createMoneyAnimationDisplayModel({ amountYen, mode });

      expect(model.amountYen).toBe(amountYen);
      expect(model.formattedAmount).toBe(
        `${new Intl.NumberFormat("ja-JP").format(amountYen)}円`,
      );
      expect(model.particleCount).toBeGreaterThanOrEqual(0);
      expect(model.particleCount).toBeLessThanOrEqual(
        MONEY_ANIMATION_MAX_PARTICLE_COUNT,
      );
      expect(Object.isFrozen(model)).toBe(true);
    },
  );

  it.each([
    ["earned", "今回得になった金額", "獲得"],
    ["wasted", "今回浪費した金額", "浪費"],
  ] as const)("uses fixed %s copy", (mode, amountLabel, modeLabel) => {
    expect(createMoneyAnimationDisplayModel({ amountYen: 1, mode })).toMatchObject({
      amountLabel,
      modeLabel,
    });
  });
});

describe("amountToVisualCount", () => {
  it.each([
    [0, 0],
    [1, 3],
    [999, 3],
    [1_000, 5],
    [9_999, 5],
    [10_000, 7],
    [99_999, 7],
    [100_000, 9],
    [999_999, 9],
    [1_000_000, 11],
    [9_999_999, 11],
    [10_000_000, 12],
    [Number.MAX_SAFE_INTEGER, 12],
  ])("maps %d yen to %d decorative particles", (amountYen, expected) => {
    expect(amountToVisualCount(amountYen)).toBe(expected);
  });

  it("never treats decorative particles as the amount", () => {
    const amountYen = 1_234_567;
    const model = createMoneyAnimationDisplayModel({ amountYen, mode: "earned" });

    expect(model.formattedAmount).toBe("1,234,567円");
    expect(model.particleCount).toBeGreaterThanOrEqual(
      MONEY_ANIMATION_MIN_PARTICLE_COUNT,
    );
    expect(model.particleCount).toBeLessThan(amountYen);
  });
});

describe("MoneyAnimation input validation", () => {
  it.each([
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects invalid amountYen %s", (amountYen) => {
    expect(() => validateMoneyAnimationInput({ amountYen, mode: "earned" })).toThrow(
      expect.objectContaining({ code: "INVALID_AMOUNT_YEN" }),
    );
  });

  it("rejects an unknown mode without echoing it", () => {
    const privateValue = "private-money-mode";
    try {
      validateMoneyAnimationInput({
        amountYen: 1,
        mode: privateValue as MoneyAnimationMode,
      });
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(MoneyAnimationError);
      expect(error).toMatchObject({ code: "INVALID_MODE" });
      expect((error as Error).message).not.toContain(privateValue);
    }
  });

  it("validates formatter input too", () => {
    expect(() => formatMoneyAnimationAmount(-1)).toThrow(
      expect.objectContaining({ code: "INVALID_AMOUNT_YEN" }),
    );
  });
});
