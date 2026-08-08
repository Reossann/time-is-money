import { describe, expect, it } from "vitest";

import { validSessionResult } from "../test/fixtures/sessionResult";
import { moneyBreakdownSchema, sessionResultSchema } from "./sessionResultSchemas";

describe("moneyBreakdownSchema", () => {
  it("accepts whole JPY amounts with the net invariant", () => {
    expect(
      moneyBreakdownSchema.parse({
        earnedYen: 12,
        wastedYen: 5,
        netYen: 7,
      }),
    ).toEqual({ earnedYen: 12, wastedYen: 5, netYen: 7 });
  });

  it.each([
    { earnedYen: 1, wastedYen: 0, netYen: 2 },
    { earnedYen: -1, wastedYen: 0, netYen: -1 },
    { earnedYen: 1.5, wastedYen: 0, netYen: 1.5 },
  ])("rejects an invalid money breakdown", (money) => {
    expect(moneyBreakdownSchema.safeParse(money).success).toBe(false);
  });
});

describe("sessionResultSchema", () => {
  it("accepts the version 1 result with an unclassified app", () => {
    expect(sessionResultSchema.parse(validSessionResult)).toEqual(
      validSessionResult,
    );
  });

  it("accepts an untracked-only session", () => {
    expect(
      sessionResultSchema.parse({
        ...validSessionResult,
        trackedDurationSeconds: 0,
        untrackedDurationSeconds: 9,
        apps: [],
        totals: { earnedYen: 0, wastedYen: 0, netYen: 0 },
      }),
    ).toMatchObject({ apps: [], untrackedDurationSeconds: 9 });
  });

  it("rejects stop-boundary and duration coverage mismatches", () => {
    expect(
      sessionResultSchema.safeParse({
        ...validSessionResult,
        endedAt: validSessionResult.startedAt - 1,
      }).success,
    ).toBe(false);
    expect(
      sessionResultSchema.safeParse({
        ...validSessionResult,
        durationSeconds: 10,
      }).success,
    ).toBe(false);
    expect(
      sessionResultSchema.safeParse({
        ...validSessionResult,
        untrackedDurationSeconds: 2,
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate IDs and a non-deterministic app order", () => {
    expect(
      sessionResultSchema.safeParse({
        ...validSessionResult,
        trackedDurationSeconds: 10,
        untrackedDurationSeconds: 0,
        apps: [
          validSessionResult.apps[0],
          {
            ...validSessionResult.apps[0],
            durationSeconds: 5,
          },
        ],
        totals: { earnedYen: 10, wastedYen: 0, netYen: 10 },
      }).success,
    ).toBe(false);
    expect(
      sessionResultSchema.safeParse({
        ...validSessionResult,
        apps: [...validSessionResult.apps].reverse(),
      }).success,
    ).toBe(false);
  });

  it("rejects totals that differ from the app money", () => {
    expect(
      sessionResultSchema.safeParse({
        ...validSessionResult,
        totals: { earnedYen: 4, wastedYen: 0, netYen: 4 },
      }).success,
    ).toBe(false);
  });

  it.each(["windowTitle", "processId", "fullPath", "url", "ownerId"]) (
    "rejects private or future field %s",
    (field) => {
      expect(
        sessionResultSchema.safeParse({
          ...validSessionResult,
          [field]: "private",
        }).success,
      ).toBe(false);
    },
  );

  it("rejects snake_case, unknown categories, and invalid hourly rates", () => {
    const snakeCase = { ...validSessionResult } as Record<string, unknown>;
    Reflect.deleteProperty(snakeCase, "sessionId");
    snakeCase.session_id = validSessionResult.sessionId;

    expect(sessionResultSchema.safeParse(snakeCase).success).toBe(false);
    expect(
      sessionResultSchema.safeParse({
        ...validSessionResult,
        apps: [
          {
            ...validSessionResult.apps[0],
            category: "unknown",
          },
          validSessionResult.apps[1],
        ],
      }).success,
    ).toBe(false);
    expect(
      sessionResultSchema.safeParse({
        ...validSessionResult,
        apps: [
          {
            ...validSessionResult.apps[0],
            hourlyRateYen: Number.NaN,
          },
          validSessionResult.apps[1],
        ],
      }).success,
    ).toBe(false);
  });
});
