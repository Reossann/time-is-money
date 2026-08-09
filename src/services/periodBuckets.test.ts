import { describe, expect, it } from "vitest";

import { createEmptyPeriodAggregates, createPeriodBuckets } from "./periodBuckets";

describe("createPeriodBuckets", () => {
  it("uses Japan calendar boundaries rather than the host timezone", () => {
    expect(
      createPeriodBuckets({
        ownerId: "owner",
        granularity: "day",
        from: "2026-01-01T14:00:00.000Z",
        to: "2026-01-02T15:00:00.000Z",
        timeZoneId: "Asia/Tokyo",
      }),
    ).toEqual([
      {
        granularity: "day",
        key: "2026-01-01",
        startAt: "2025-12-31T15:00:00.000Z",
        endAt: "2026-01-01T15:00:00.000Z",
        timeZoneId: "Asia/Tokyo",
      },
      {
        granularity: "day",
        key: "2026-01-02",
        startAt: "2026-01-01T15:00:00.000Z",
        endAt: "2026-01-02T15:00:00.000Z",
        timeZoneId: "Asia/Tokyo",
      },
    ]);
  });

  it("keeps `[from,to)` exact at a local midnight", () => {
    expect(
      createPeriodBuckets({
        ownerId: "owner",
        granularity: "day",
        from: "2026-01-01T15:00:00.000Z",
        to: "2026-01-02T15:00:00.000Z",
        timeZoneId: "Asia/Tokyo",
      }).map((bucket) => bucket.key),
    ).toEqual(["2026-01-02"]);
  });

  it("handles daylight-saving start and end with their real UTC boundaries", () => {
    const start = createPeriodBuckets({
      ownerId: "owner",
      granularity: "day",
      from: "2026-03-08T05:00:00.000Z",
      to: "2026-03-09T04:00:00.000Z",
      timeZoneId: "America/New_York",
    });
    const end = createPeriodBuckets({
      ownerId: "owner",
      granularity: "day",
      from: "2026-11-01T04:00:00.000Z",
      to: "2026-11-02T05:00:00.000Z",
      timeZoneId: "America/New_York",
    });

    expect(start[0]).toMatchObject({
      key: "2026-03-08",
      startAt: "2026-03-08T05:00:00.000Z",
      endAt: "2026-03-09T04:00:00.000Z",
    });
    expect(end[0]).toMatchObject({
      key: "2026-11-01",
      startAt: "2026-11-01T04:00:00.000Z",
      endAt: "2026-11-02T05:00:00.000Z",
    });
  });

  it("creates ISO weeks across a year boundary and months across leap day", () => {
    expect(
      createPeriodBuckets({
        ownerId: "owner",
        granularity: "week",
        from: "2025-12-29T00:00:00.000Z",
        to: "2026-01-05T00:00:00.000Z",
        timeZoneId: "UTC",
      })[0],
    ).toMatchObject({ key: "2026-W01", startAt: "2025-12-29T00:00:00.000Z" });
    expect(
      createPeriodBuckets({
        ownerId: "owner",
        granularity: "month",
        from: "2024-02-01T00:00:00.000Z",
        to: "2024-03-01T00:00:00.000Z",
        timeZoneId: "UTC",
      })[0],
    ).toMatchObject({ key: "2024-02", endAt: "2024-03-01T00:00:00.000Z" });
  });
});

describe("createEmptyPeriodAggregates", () => {
  it("emits zero-filled boundaries only when requested", () => {
    const query = {
      ownerId: "owner",
      granularity: "day" as const,
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-03T00:00:00.000Z",
      timeZoneId: "UTC",
    };
    expect(createEmptyPeriodAggregates(query)).toEqual([]);
    expect(
      createEmptyPeriodAggregates({ ...query, includeEmptyPeriods: true }),
    ).toHaveLength(2);
  });
});
