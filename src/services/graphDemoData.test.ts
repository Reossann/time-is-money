import { describe, expect, it } from "vitest";

import { demoGraphQueryService } from "./graphDemoData";

describe("demoGraphQueryService", () => {
  it.each([
    ["day", 7],
    ["week", 5],
    ["month", 5],
  ] as const)("returns demo points for %s", async (period, expectedLength) => {
    const data = await demoGraphQueryService.getGraphData({
      accountId: "demo-account",
      period,
      metric: "netYen",
    });

    expect(data.period).toBe(period);
    expect(data.metric).toBe("netYen");
    expect(data.points).toHaveLength(expectedLength);
    expect(data.points.every((point) => point.netYen === point.earnedYen - point.wastedYen)).toBe(true);
  });
});
