import { describe, expect, it } from "vitest";

import { createAggregationClient, MAX_AGGREGATION_RANGE_MILLISECONDS } from "./aggregationClient";
import type { SessionHistoryAdapter } from "./sessionHistoryAdapter";

const history: SessionHistoryAdapter = {
  listByOwnerAndRange: async () => [],
};

const query = {
  ownerId: "owner",
  granularity: "month" as const,
  from: "2026-01-01T00:00:00.000Z",
  to: "2026-02-01T00:00:00.000Z",
  timeZoneId: "UTC",
};

describe("AggregationClient", () => {
  it("uses an injected history boundary so browser tests do not start Tauri", async () => {
    const client = createAggregationClient(history);
    await expect(client.getPeriodAggregates(query)).resolves.toEqual([]);
  });

  it("rejects a range above the fixed limit before reading history", async () => {
    const client = createAggregationClient(history);
    const to = new Date(Date.parse(query.from) + MAX_AGGREGATION_RANGE_MILLISECONDS + 1);
    await expect(
      client.getPeriodAggregates({ ...query, to: to.toISOString() }),
    ).rejects.toMatchObject({ code: "QUERY_LIMIT_EXCEEDED" });
  });

  it("keeps the domain error code when owner context is missing", async () => {
    const client = createAggregationClient(history);
    await expect(
      client.getPeriodAggregates({ ...query, ownerId: "" }),
    ).rejects.toMatchObject({ code: "OWNER_CONTEXT_REQUIRED" });
  });
});
