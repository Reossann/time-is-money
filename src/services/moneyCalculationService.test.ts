import { describe, expect, it } from "vitest";

import type { MoneyCalculationInput } from "../types/money";
import {
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
