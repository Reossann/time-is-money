import { describe, expect, it, vi } from "vitest";

import { createAggregationGraphDataSource } from "./aggregationGraphDataSource";

describe("createAggregationGraphDataSource", () => {
  it("uses one aggregation client and passes #41 the requested metric", async () => {
    const getPeriodAggregates = vi.fn().mockResolvedValue([]);
    const source = createAggregationGraphDataSource(
      { getPeriodAggregates },
      () => ({
        ownerId: "owner",
        granularity: "day",
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-08-02T00:00:00.000Z",
        timeZoneId: "UTC",
      }),
    );

    await expect(
      source.query({ accountId: "owner", period: "week", metric: "earnedYen" }),
    ).resolves.toEqual({ period: "week", metric: "earnedYen", points: [] });
    expect(getPeriodAggregates).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "owner", granularity: "week" }),
    );
  });
});
