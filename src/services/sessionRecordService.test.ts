import { describe, expect, it } from "vitest";

import { validSessionResult } from "../test/fixtures/sessionResult";
import { toLocalDateKey } from "../utils/localDate";
import {
  buildSessionRecord,
  SessionRecordBuildError,
} from "./sessionRecordService";

const NOW = 20_000;

describe("buildSessionRecord", () => {
  it("builds a frozen record from the finalized result", () => {
    const record = buildSessionRecord({
      result: validSessionResult,
      ownerId: "owner-1",
      now: NOW,
    });

    expect(record).toMatchObject({
      schemaVersion: 1,
      sessionId: validSessionResult.sessionId,
      ownerId: "owner-1",
      startedAt: validSessionResult.startedAt,
      endedAt: validSessionResult.endedAt,
      durationSeconds: validSessionResult.durationSeconds,
      totals: validSessionResult.totals,
      localDateKey: toLocalDateKey(validSessionResult.endedAt),
      createdAt: NOW,
      updatedAt: NOW,
      syncStatus: "local-only",
    });
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.apps)).toBe(true);
    expect(Object.isFrozen(record.totals)).toBe(true);
  });

  it("preserves the finalized app order and money", () => {
    const record = buildSessionRecord({
      result: validSessionResult,
      ownerId: "owner-1",
      now: NOW,
    });

    expect(record.apps.map((app) => app.appId)).toEqual(
      validSessionResult.apps.map((app) => app.appId),
    );
  });

  it("honors an explicit sync status", () => {
    const record = buildSessionRecord({
      result: validSessionResult,
      ownerId: "owner-1",
      now: NOW,
      syncStatus: "pending-sync",
    });

    expect(record.syncStatus).toBe("pending-sync");
  });

  it("rejects an empty owner id", () => {
    expect(() =>
      buildSessionRecord({ result: validSessionResult, ownerId: "  ", now: NOW }),
    ).toThrowError(SessionRecordBuildError);
  });

  it.each([-1, 1.5, Number.NaN])("rejects the invalid now value %p", (now) => {
    expect(() =>
      buildSessionRecord({ result: validSessionResult, ownerId: "owner-1", now }),
    ).toThrowError(SessionRecordBuildError);
  });

  it("reports the build error code for an invalid owner", () => {
    try {
      buildSessionRecord({ result: validSessionResult, ownerId: "", now: NOW });
      expect.unreachable("expected buildSessionRecord to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(SessionRecordBuildError);
      expect((error as SessionRecordBuildError).code).toBe("INVALID_OWNER_ID");
    }
  });
});
