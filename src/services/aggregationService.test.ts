import { describe, expect, it } from "vitest";

import type { SessionHistoryAdapter } from "./sessionHistoryAdapter";
import {
  aggregateLifetimeMoneySummary,
  aggregateSessionHistory,
} from "./aggregationService";
import { buildSessionRecord } from "./sessionRecordService";
import { AggregationError } from "../types/aggregation";

function record(
  sessionId: string,
  ownerId: string,
  endedAt: number,
  earnedYen: number,
  wastedYen: number,
) {
  const durationSeconds = 600;
  const netYen = earnedYen - wastedYen;
  return buildSessionRecord({
    ownerId,
    now: endedAt + 1,
    result: {
      schemaVersion: 1,
      sessionId,
      startedAt: endedAt - durationSeconds * 1_000,
      endedAt,
      durationSeconds,
      trackedDurationSeconds: durationSeconds,
      untrackedDurationSeconds: 0,
      apps: [
        {
          appId: "code.exe",
          processName: "code.exe",
          durationSeconds,
          category: earnedYen > 0 ? "productive" : wastedYen > 0 ? "waste" : "neutral",
          hourlyRateYen: 3_600,
          money: { earnedYen, wastedYen, netYen },
        },
      ],
      totals: { earnedYen, wastedYen, netYen },
    },
  });
}

function history(records: readonly ReturnType<typeof record>[]): SessionHistoryAdapter {
  return {
    listByOwnerAndRange: async () => records,
  };
}

const query = {
  ownerId: "owner-a",
  granularity: "day" as const,
  from: "2026-01-01T15:00:00.000Z",
  to: "2026-01-04T15:00:00.000Z",
  timeZoneId: "Asia/Tokyo",
};

describe("aggregateSessionHistory", () => {
  it("adds only canonical saved records, without recalculating their money", async () => {
    const first = record("session-1", "owner-a", Date.parse("2026-01-01T16:00:00.000Z"), 7, 0);
    const second = record("session-2", "owner-a", Date.parse("2026-01-01T17:00:00.000Z"), 0, 3);
    const neutral = record("session-3", "owner-a", Date.parse("2026-01-02T16:00:00.000Z"), 0, 0);

    await expect(aggregateSessionHistory(query, history([first, second, neutral]))).resolves.toMatchObject([
      { period: { key: "2026-01-02" }, sessionCount: 2, durationSeconds: 1200, earnedYen: 7, wastedYen: 3, netYen: 4 },
      { period: { key: "2026-01-03" }, sessionCount: 1, durationSeconds: 600, earnedYen: 0, wastedYen: 0, netYen: 0 },
    ]);
  });

  it("deduplicates session IDs and excludes a different owner or an out-of-range record", async () => {
    const included = record("session-1", "owner-a", Date.parse("2026-01-01T16:00:00.000Z"), 5, 0);
    const otherOwner = record("session-2", "owner-b", Date.parse("2026-01-01T16:00:00.000Z"), 999, 0);
    const outside = record("session-3", "owner-a", Date.parse("2026-01-04T15:00:00.000Z"), 999, 0);

    await expect(aggregateSessionHistory(query, history([included, included, otherOwner, outside]))).resolves.toMatchObject([
      { sessionCount: 1, earnedYen: 5 },
    ]);
  });

  it("zero-fills requested boundaries and otherwise omits empty periods", async () => {
    await expect(aggregateSessionHistory(query, history([]))).resolves.toEqual([]);
    await expect(
      aggregateSessionHistory({ ...query, includeEmptyPeriods: true }, history([])),
    ).resolves.toHaveLength(3);
  });

  it.each([
    [{ ...query, ownerId: "" }, "OWNER_CONTEXT_REQUIRED"],
    [{ ...query, timeZoneId: "Not/A_Timezone" }, "UNSUPPORTED_TIME_ZONE"],
    [{ ...query, from: query.to }, "INVALID_PERIOD_RANGE"],
  ] as const)("returns %s for an invalid query", async (input, code) => {
    await expect(aggregateSessionHistory(input, history([]))).rejects.toMatchObject({ code });
  });

  it("maps repository failure to a safe error code", async () => {
    const failingHistory: SessionHistoryAdapter = {
      listByOwnerAndRange: async () => Promise.reject(new Error("database details")),
    };
    await expect(aggregateSessionHistory(query, failingHistory)).rejects.toMatchObject({
      code: "HISTORY_QUERY_FAILED",
    });
  });

  it("preserves a safe history query limit error", async () => {
    const limitedHistory: SessionHistoryAdapter = {
      listByOwnerAndRange: async () =>
        Promise.reject(
          new AggregationError("QUERY_LIMIT_EXCEEDED", "history result limit exceeded"),
        ),
    };
    await expect(aggregateSessionHistory(query, limitedHistory)).rejects.toMatchObject({
      code: "QUERY_LIMIT_EXCEEDED",
    });
  });
});

describe("aggregateLifetimeMoneySummary", () => {
  it("sums all canonical records for one owner without a period-range limit", async () => {
    const first = record("session-1", "owner-a", Date.parse("2020-01-01T00:00:00.000Z"), 7, 0);
    const second = record("session-2", "owner-a", Date.parse("2026-01-01T00:00:00.000Z"), 0, 3);
    const otherOwner = record("session-3", "owner-b", Date.parse("2026-01-01T00:00:00.000Z"), 999, 0);

    await expect(
      aggregateLifetimeMoneySummary("owner-a", history([first, first, second, otherOwner])),
    ).resolves.toEqual({
      ownerId: "owner-a",
      sessionCount: 2,
      earnedYen: 7,
      wastedYen: 3,
      netYen: 4,
    });
  });

  it("returns a zero summary when the owner has no saved records", async () => {
    await expect(aggregateLifetimeMoneySummary("owner-a", history([]))).resolves.toEqual({
      ownerId: "owner-a",
      sessionCount: 0,
      earnedYen: 0,
      wastedYen: 0,
      netYen: 0,
    });
  });

  it("normalizes surrounding whitespace in the owner context", async () => {
    const saved = record("session-1", "owner-a", Date.parse("2026-01-01T00:00:00.000Z"), 5, 0);

    await expect(
      aggregateLifetimeMoneySummary("  owner-a  ", history([saved])),
    ).resolves.toMatchObject({ ownerId: "owner-a", earnedYen: 5 });
  });

  it("keeps owner and history failures inside the aggregation error contract", async () => {
    await expect(aggregateLifetimeMoneySummary("", history([]))).rejects.toMatchObject({
      code: "OWNER_CONTEXT_REQUIRED",
    });
    const failingHistory: SessionHistoryAdapter = {
      listByOwnerAndRange: async () => Promise.reject(new Error("database details")),
    };
    await expect(
      aggregateLifetimeMoneySummary("owner-a", failingHistory),
    ).rejects.toMatchObject({ code: "HISTORY_QUERY_FAILED" });
  });
});
