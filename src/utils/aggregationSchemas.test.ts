import { describe, expect, it } from "vitest";

import sharedFixture from "../../fixtures/contracts/aggregation-v1.json";
import {
  aggregationQuerySchema,
  periodAggregateSchema,
} from "./aggregationSchemas";

describe("aggregationQuerySchema", () => {
  it("accepts the shared query fixture", () => {
    expect(aggregationQuerySchema.parse(sharedFixture.query)).toEqual(
      sharedFixture.query,
    );
  });

  it.each([
    { ...sharedFixture.query, ownerId: "" },
    { ...sharedFixture.query, from: sharedFixture.query.to },
    { ...sharedFixture.query, timeZoneId: "Not/A_Timezone" },
    { ...sharedFixture.query, from: "2026-01-01" },
    { ...sharedFixture.query, extra: true },
  ])("rejects an invalid query", (query) => {
    expect(aggregationQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe("periodAggregateSchema", () => {
  it("accepts multiple sessions, monetary changes, and an empty period", () => {
    expect(
      sharedFixture.aggregates.map((aggregate) =>
        periodAggregateSchema.parse(aggregate),
      ),
    ).toEqual(sharedFixture.aggregates);
  });

  it.each([
    {
      ...sharedFixture.aggregates[0],
      trackedDurationSeconds: 1,
    },
    {
      ...sharedFixture.aggregates[0],
      netYen: 999,
    },
    {
      ...sharedFixture.aggregates[0],
      earnedYen: Number.MAX_SAFE_INTEGER + 1,
    },
    {
      ...sharedFixture.aggregates[0],
      period: { ...sharedFixture.aggregates[0].period, key: "2026-1" },
    },
    {
      ...sharedFixture.aggregates[0],
      period: {
        ...sharedFixture.aggregates[0].period,
        startAt: sharedFixture.aggregates[0].period.endAt,
      },
    },
  ])("rejects an invalid aggregate", (aggregate) => {
    expect(periodAggregateSchema.safeParse(aggregate).success).toBe(false);
  });
});
