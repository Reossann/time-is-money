import { describe, expect, it } from "vitest";

import { presentCalendarPeriodSummaries, presentGraphData } from "./aggregationPresenter";

const aggregates = [
  {
    period: {
      granularity: "day" as const,
      key: "2026-08-09",
      startAt: "2026-08-08T15:00:00.000Z",
      endAt: "2026-08-09T15:00:00.000Z",
      timeZoneId: "Asia/Tokyo",
    },
    sessionCount: 2,
    durationSeconds: 3_661,
    trackedDurationSeconds: 3_600,
    untrackedDurationSeconds: 61,
    earnedYen: 120,
    wastedYen: 20,
    netYen: 100,
  },
] as const;

describe("aggregationPresenter", () => {
  it("formats calendar-safe values without changing the aggregate amounts", () => {
    expect(presentCalendarPeriodSummaries(aggregates)).toMatchObject([
      {
        key: "2026-08-09",
        label: "2026/08/09",
        durationText: "1:01:01",
        earnedYen: 120,
        wastedYen: 20,
        netYen: 100,
      },
    ]);
  });

  it("maps the same aggregate values to the existing graph contract", () => {
    expect(presentGraphData(aggregates, "day", "netYen")).toEqual({
      period: "day",
      metric: "netYen",
      points: [
        {
          dateKey: "2026-08-09",
          label: "2026/08/09",
          usageSeconds: 3_661,
          earnedYen: 120,
          wastedYen: 20,
          netYen: 100,
        },
      ],
    });
  });
});
