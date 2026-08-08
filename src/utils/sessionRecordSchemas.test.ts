import { describe, expect, it } from "vitest";

import { validSessionResult } from "../test/fixtures/sessionResult";
import { toLocalDateKey } from "./localDate";
import { sessionRecordSchema } from "./sessionRecordSchemas";

const validRecord = {
  schemaVersion: 1,
  sessionId: validSessionResult.sessionId,
  ownerId: "owner-1",
  startedAt: validSessionResult.startedAt,
  endedAt: validSessionResult.endedAt,
  durationSeconds: validSessionResult.durationSeconds,
  trackedDurationSeconds: validSessionResult.trackedDurationSeconds,
  untrackedDurationSeconds: validSessionResult.untrackedDurationSeconds,
  apps: validSessionResult.apps,
  totals: validSessionResult.totals,
  localDateKey: toLocalDateKey(validSessionResult.endedAt),
  createdAt: 20_000,
  updatedAt: 20_000,
  syncStatus: "local-only",
} as const;

describe("sessionRecordSchema", () => {
  it("accepts a well-formed record", () => {
    expect(() => sessionRecordSchema.parse(validRecord)).not.toThrow();
  });

  it("rejects unknown fields", () => {
    expect(() =>
      sessionRecordSchema.parse({ ...validRecord, windowTitle: "secret" }),
    ).toThrow();
  });

  it("rejects an empty owner id", () => {
    expect(() =>
      sessionRecordSchema.parse({ ...validRecord, ownerId: "   " }),
    ).toThrow();
  });

  it("rejects a localDateKey that does not match endedAt", () => {
    expect(() =>
      sessionRecordSchema.parse({ ...validRecord, localDateKey: "1999-12-31" }),
    ).toThrow();
  });

  it("rejects a malformed localDateKey", () => {
    expect(() =>
      sessionRecordSchema.parse({ ...validRecord, localDateKey: "2026/01/15" }),
    ).toThrow();
  });

  it("rejects updatedAt earlier than createdAt", () => {
    expect(() =>
      sessionRecordSchema.parse({
        ...validRecord,
        createdAt: 30_000,
        updatedAt: 20_000,
      }),
    ).toThrow();
  });

  it("rejects an unknown sync status", () => {
    expect(() =>
      sessionRecordSchema.parse({ ...validRecord, syncStatus: "uploaded" }),
    ).toThrow();
  });

  it("rejects totals that disagree with the app money sum", () => {
    expect(() =>
      sessionRecordSchema.parse({
        ...validRecord,
        totals: { earnedYen: 999, wastedYen: 0, netYen: 999 },
      }),
    ).toThrow();
  });

  it("rejects a tracked/untracked split that does not cover the session", () => {
    expect(() =>
      sessionRecordSchema.parse({
        ...validRecord,
        untrackedDurationSeconds: 5,
      }),
    ).toThrow();
  });
});
