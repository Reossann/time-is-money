import { describe, expect, it } from "vitest";

import { evaluateAppUsageLimitNotifications } from "./appUsageLimitEvaluationService";

describe("evaluateAppUsageLimitNotifications", () => {
  it("emits the daily five notification boundaries in order", () => {
    const events = evaluateAppUsageLimitNotifications("daily", 60 * 60, 0, 75 * 60);

    expect(events.map((event) => event.notification)).toEqual([
      "remaining-15-minutes",
      "remaining-5-minutes",
      "reached",
      "exceeded-5-minutes",
      "exceeded-15-minutes",
    ]);
  });

  it("does not emit lead-time notifications for limits shorter than them", () => {
    const events = evaluateAppUsageLimitNotifications("continuous", 10 * 60, 0, 20 * 60);

    expect(events.map((event) => event.notification)).toEqual([
      "remaining-5-minutes",
      "reached",
      "exceeded-5-minutes",
    ]);
  });

  it("does not emit a five-minute lead notification for a limit shorter than five minutes", () => {
    const events = evaluateAppUsageLimitNotifications("daily", 4 * 60, 0, 10 * 60);

    expect(events.map((event) => event.notification)).toEqual([
      "reached",
      "exceeded-5-minutes",
    ]);
  });

  it("only emits boundaries crossed by the current sample", () => {
    const events = evaluateAppUsageLimitNotifications("continuous", 60 * 60, 44 * 60, 46 * 60);

    expect(events.map((event) => event.notification)).toEqual(["remaining-15-minutes"]);
  });

  it("rejects invalid or backwards samples", () => {
    expect(evaluateAppUsageLimitNotifications("daily", 0, 0, 1)).toEqual([]);
    expect(evaluateAppUsageLimitNotifications("daily", 60, 30, 20)).toEqual([]);
    expect(evaluateAppUsageLimitNotifications("daily", 60, 0, Number.NaN)).toEqual([]);
  });
});
