import { describe, expect, it } from "vitest";

import { buildSessionRecord } from "../services/sessionRecordService";
import { validSessionResult } from "../test/fixtures/sessionResult";
import type { SessionRecord } from "../types/sessionRecord";
import {
  mapRowsToSessionRecord,
  toAppBindValues,
  toParentBindValues,
  type SessionRecordAppRow,
  type SessionRecordParentRow,
} from "./sessionRecordRowMapper";

const record: SessionRecord = buildSessionRecord({
  result: validSessionResult,
  ownerId: "owner-1",
  now: 20_000,
});

function parentRowOf(source: SessionRecord): SessionRecordParentRow {
  return {
    session_id: source.sessionId,
    schema_version: source.schemaVersion,
    owner_id: source.ownerId,
    started_at: source.startedAt,
    ended_at: source.endedAt,
    duration_seconds: source.durationSeconds,
    tracked_duration_seconds: source.trackedDurationSeconds,
    untracked_duration_seconds: source.untrackedDurationSeconds,
    earned_yen: source.totals.earnedYen,
    wasted_yen: source.totals.wastedYen,
    net_yen: source.totals.netYen,
    local_date_key: source.localDateKey,
    created_at: source.createdAt,
    updated_at: source.updatedAt,
    sync_status: source.syncStatus,
  };
}

function appRowsOf(source: SessionRecord): SessionRecordAppRow[] {
  return source.apps.map((app) => ({
    session_id: source.sessionId,
    app_id: app.appId,
    process_name: app.processName,
    duration_seconds: app.durationSeconds,
    category: app.category,
    hourly_rate_yen: app.hourlyRateYen,
    earned_yen: app.money.earnedYen,
    wasted_yen: app.money.wastedYen,
    net_yen: app.money.netYen,
  }));
}

describe("sessionRecordRowMapper", () => {
  it("builds parent bind values in column order", () => {
    expect(toParentBindValues(record)).toEqual([
      record.sessionId,
      1,
      "owner-1",
      record.startedAt,
      record.endedAt,
      record.durationSeconds,
      record.trackedDurationSeconds,
      record.untrackedDurationSeconds,
      record.totals.earnedYen,
      record.totals.wastedYen,
      record.totals.netYen,
      record.localDateKey,
      record.createdAt,
      record.updatedAt,
      "local-only",
    ]);
  });

  it("builds app bind values in column order", () => {
    const [firstApp] = record.apps;
    expect(toAppBindValues(record.sessionId, firstApp)).toEqual([
      record.sessionId,
      firstApp.appId,
      firstApp.processName,
      firstApp.durationSeconds,
      firstApp.category,
      firstApp.hourlyRateYen,
      firstApp.money.earnedYen,
      firstApp.money.wastedYen,
      firstApp.money.netYen,
    ]);
  });

  it("round-trips a record through rows", () => {
    const mapped = mapRowsToSessionRecord(
      parentRowOf(record),
      appRowsOf(record),
    );
    expect(mapped).toEqual(record);
  });

  it("throws when stored rows fail validation", () => {
    const badParent = { ...parentRowOf(record), local_date_key: "1999-12-31" };
    expect(() => mapRowsToSessionRecord(badParent, appRowsOf(record))).toThrow();
  });
});
