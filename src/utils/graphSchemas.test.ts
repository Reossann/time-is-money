import { describe, expect, it } from "vitest";

import { graphDataSchema, graphPointSchema } from "./graphSchemas";

const validPoint = {
  dateKey: "2026-08-09",
  label: "8/9",
  usageSeconds: 3_600,
  earnedYen: 1_000,
  wastedYen: 200,
  netYen: 800,
} as const;

const validGraphData = {
  period: "day",
  metric: "netYen",
  points: [validPoint],
} as const;

describe("graphPointSchema", () => {
  it("accepts a valid graph point", () => {
    expect(graphPointSchema.safeParse(validPoint).success).toBe(true);
  });

  it("rejects a negative usage or amount", () => {
    expect(
      graphPointSchema.safeParse({ ...validPoint, usageSeconds: -1 }).success,
    ).toBe(false);
    expect(
      graphPointSchema.safeParse({ ...validPoint, earnedYen: -1 }).success,
    ).toBe(false);
  });

  it("rejects an inconsistent net amount", () => {
    expect(
      graphPointSchema.safeParse({ ...validPoint, netYen: 999 }).success,
    ).toBe(false);
  });

  it("rejects unknown fields and empty labels", () => {
    expect(
      graphPointSchema.safeParse({ ...validPoint, extra: true }).success,
    ).toBe(false);
    expect(
      graphPointSchema.safeParse({ ...validPoint, label: "" }).success,
    ).toBe(false);
  });
});

describe("graphDataSchema", () => {
  it("accepts valid period, metric, and points", () => {
    expect(graphDataSchema.safeParse(validGraphData).success).toBe(true);
  });

  it("accepts an empty points array", () => {
    expect(
      graphDataSchema.safeParse({ ...validGraphData, points: [] }).success,
    ).toBe(true);
  });

  it("rejects unsupported period and metric values", () => {
    expect(
      graphDataSchema.safeParse({ ...validGraphData, period: "year" }).success,
    ).toBe(false);
    expect(
      graphDataSchema.safeParse({ ...validGraphData, metric: "cost" }).success,
    ).toBe(false);
  });
});
