import { describe, expect, it } from "vitest";

import type { MoneyCalculationInput } from "../types/money";
import {
  calculateMoneyBreakdown,
  MoneyCalculationError,
  validateMoneyCalculationInput,
} from "./moneyCalculationService";

describe("validateMoneyCalculationInput", () => {
  it.each([
    ["productive", "productive"],
    ["waste", "waste"],
    ["neutral", "neutral"],
    ["unclassified null", null],
    ["unclassified undefined", undefined],
  ] as const)("accepts %s category", (_label, category) => {
    expect(() =>
      validateMoneyCalculationInput({
        durationSeconds: 0,
        hourlyRateYen: 0,
        category,
      }),
    ).not.toThrow();
  });

  it("accepts a fractional hourly rate", () => {
    expect(() =>
      validateMoneyCalculationInput({
        durationSeconds: 1,
        hourlyRateYen: 1_234.5,
        category: "productive",
      }),
    ).not.toThrow();
  });

  it.each([
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects invalid durationSeconds %s", (durationSeconds) => {
    expect(() =>
      validateMoneyCalculationInput({
        durationSeconds,
        hourlyRateYen: 1_000,
        category: "productive",
      }),
    ).toThrow(
      expect.objectContaining({ code: "INVALID_DURATION_SECONDS" }),
    );
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid hourlyRateYen %s",
    (hourlyRateYen) => {
      expect(() =>
        validateMoneyCalculationInput({
          durationSeconds: 1,
          hourlyRateYen,
          category: "productive",
        }),
      ).toThrow(expect.objectContaining({ code: "INVALID_HOURLY_RATE" }));
    },
  );

  it("rejects an unknown category instead of treating it as unclassified", () => {
    const input = {
      durationSeconds: 1,
      hourlyRateYen: 1_000,
      category: "focus",
    } as unknown as MoneyCalculationInput;

    expect(() => validateMoneyCalculationInput(input)).toThrow(
      expect.objectContaining({ code: "UNKNOWN_CATEGORY" }),
    );
  });

  it("does not expose an invalid category value in the error", () => {
    const privateValue = "Private window https://example.com/private";
    const input = {
      durationSeconds: 1,
      hourlyRateYen: 1_000,
      category: privateValue,
    } as unknown as MoneyCalculationInput;

    try {
      validateMoneyCalculationInput(input);
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(MoneyCalculationError);
      expect(error).toMatchObject({ code: "UNKNOWN_CATEGORY" });
      expect((error as Error).message).not.toContain(privateValue);
    }
  });
});

describe("calculateMoneyBreakdown", () => {
  it.each([
    {
      label: "productive",
      category: "productive",
      expected: { earnedYen: 3_000, wastedYen: 0, netYen: 3_000 },
    },
    {
      label: "waste",
      category: "waste",
      expected: { earnedYen: 0, wastedYen: 3_000, netYen: -3_000 },
    },
    {
      label: "neutral",
      category: "neutral",
      expected: { earnedYen: 0, wastedYen: 0, netYen: 0 },
    },
    {
      label: "unclassified null",
      category: null,
      expected: { earnedYen: 0, wastedYen: 0, netYen: 0 },
    },
    {
      label: "unclassified undefined",
      category: undefined,
      expected: { earnedYen: 0, wastedYen: 0, netYen: 0 },
    },
  ] as const)("assigns a one-hour record for $label", ({ category, expected }) => {
    expect(
      calculateMoneyBreakdown({
        durationSeconds: 3_600,
        hourlyRateYen: 3_000,
        category,
      }),
    ).toEqual(expected);
  });

  it.each([
    {
      label: "zero seconds",
      input: {
        durationSeconds: 0,
        hourlyRateYen: 3_000,
        category: "productive",
      },
      expectedYen: 0,
    },
    {
      label: "zero hourly rate",
      input: {
        durationSeconds: 3_600,
        hourlyRateYen: 0,
        category: "productive",
      },
      expectedYen: 0,
    },
    {
      label: "one second",
      input: {
        durationSeconds: 1,
        hourlyRateYen: 3_600,
        category: "productive",
      },
      expectedYen: 1,
    },
    {
      label: "fractional hourly rate",
      input: {
        durationSeconds: 3_600,
        hourlyRateYen: 1_234.5,
        category: "productive",
      },
      expectedYen: 1_235,
    },
    {
      label: "half-yen boundary",
      input: {
        durationSeconds: 1,
        hourlyRateYen: 1_800,
        category: "productive",
      },
      expectedYen: 1,
    },
    {
      label: "below half-yen boundary",
      input: {
        durationSeconds: 1,
        hourlyRateYen: 1_799,
        category: "productive",
      },
      expectedYen: 0,
    },
    {
      label: "twenty-four hours",
      input: {
        durationSeconds: 86_400,
        hourlyRateYen: 3_000,
        category: "productive",
      },
      expectedYen: 72_000,
    },
  ] as const)("rounds $label per record", ({ input, expectedYen }) => {
    expect(calculateMoneyBreakdown(input)).toEqual({
      earnedYen: expectedYen,
      wastedYen: 0,
      netYen: expectedYen,
    });
  });

  it("rejects an amount outside the safe integer range", () => {
    expect(() =>
      calculateMoneyBreakdown({
        durationSeconds: 1,
        hourlyRateYen: Number.MAX_VALUE,
        category: "productive",
      }),
    ).toThrow(expect.objectContaining({ code: "AMOUNT_OUT_OF_RANGE" }));
  });

  it("returns a new immutable result without changing its input", () => {
    const input = Object.freeze({
      durationSeconds: 3_600,
      hourlyRateYen: 3_000,
      category: "productive" as const,
    });

    const firstResult = calculateMoneyBreakdown(input);
    const secondResult = calculateMoneyBreakdown(input);

    expect(firstResult).toEqual(secondResult);
    expect(firstResult).not.toBe(secondResult);
    expect(Object.isFrozen(firstResult)).toBe(true);
    expect(input).toEqual({
      durationSeconds: 3_600,
      hourlyRateYen: 3_000,
      category: "productive",
    });
  });
});
