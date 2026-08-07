import { describe, expect, it } from "vitest";

import sharedFixture from "../../fixtures/contracts/app-usage-snapshot-v1.json";
import type { AppUsageSnapshot } from "../types/appUsageTracking";
import {
  appUsageSnapshotSchema,
  appUsageSnapshotWireSchema,
  nonnegativeSafeIntegerSchema,
} from "./appUsageTrackingSchemas";

const validPublicSnapshot = {
  schemaVersion: 1,
  sessionId: "session-a",
  startedAt: 1_000,
  capturedAt: 4_500,
  durationSeconds: 3,
  trackedDurationSeconds: 2,
  untrackedDurationSeconds: 1,
  apps: [
    {
      appId: "code.exe",
      processName: "Code.exe",
      durationSeconds: 2,
    },
  ],
} as const satisfies AppUsageSnapshot;

describe("appUsageSnapshotWireSchema", () => {
  it("accepts the shared Rust/TypeScript fixture", () => {
    expect(appUsageSnapshotWireSchema.parse(sharedFixture)).toEqual(
      sharedFixture,
    );
  });

  it("rejects snake_case and unknown schema versions", () => {
    const snakeCase = { ...sharedFixture } as Record<string, unknown>;
    Reflect.deleteProperty(snakeCase, "sessionId");
    snakeCase.session_id = sharedFixture.sessionId;

    expect(
      appUsageSnapshotWireSchema.safeParse(snakeCase).success,
    ).toBe(false);
    expect(
      appUsageSnapshotWireSchema.safeParse({
        ...sharedFixture,
        schemaVersion: 2,
      }).success,
    ).toBe(false);
  });

  it.each(["windowTitle", "processId", "fullPath", "url"])(
    "rejects private top-level field %s",
    (field) => {
      expect(
        appUsageSnapshotWireSchema.safeParse({
          ...sharedFixture,
          [field]: "private",
        }).success,
      ).toBe(false);
    },
  );

  it("rejects private app fields", () => {
    expect(
      appUsageSnapshotWireSchema.safeParse({
        ...sharedFixture,
        apps: [
          {
            ...sharedFixture.apps[0],
            windowTitle: "private title",
          },
          ...sharedFixture.apps.slice(1),
        ],
      }).success,
    ).toBe(false);
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects unsafe duration %s",
    (durationMilliseconds) => {
      expect(
        appUsageSnapshotWireSchema.safeParse({
          ...sharedFixture,
          durationMilliseconds,
        }).success,
      ).toBe(false);
      expect(nonnegativeSafeIntegerSchema.safeParse(durationMilliseconds).success)
        .toBe(false);
    },
  );

  it("rejects boundary and sum mismatches", () => {
    expect(
      appUsageSnapshotWireSchema.safeParse({
        ...sharedFixture,
        capturedAt: sharedFixture.startedAt - 1,
      }).success,
    ).toBe(false);
    expect(
      appUsageSnapshotWireSchema.safeParse({
        ...sharedFixture,
        trackedDurationMilliseconds: 2_699,
      }).success,
    ).toBe(false);
    expect(
      appUsageSnapshotWireSchema.safeParse({
        ...sharedFixture,
        untrackedDurationMilliseconds: 799,
      }).success,
    ).toBe(false);
  });
});

describe("appUsageSnapshotSchema", () => {
  it("accepts a sorted public snapshot with exact totals", () => {
    expect(appUsageSnapshotSchema.parse(validPublicSnapshot)).toEqual(
      validPublicSnapshot,
    );
  });

  it("rejects duplicate app IDs", () => {
    expect(
      appUsageSnapshotSchema.safeParse({
        ...validPublicSnapshot,
        trackedDurationSeconds: 3,
        untrackedDurationSeconds: 0,
        apps: [
          validPublicSnapshot.apps[0],
          {
            appId: "code.exe",
            processName: "CODE.EXE",
            durationSeconds: 1,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects zero-second apps and non-deterministic order", () => {
    expect(
      appUsageSnapshotSchema.safeParse({
        ...validPublicSnapshot,
        apps: [
          { appId: "code.exe", processName: "Code.exe", durationSeconds: 0 },
        ],
      }).success,
    ).toBe(false);
    expect(
      appUsageSnapshotSchema.safeParse({
        ...validPublicSnapshot,
        trackedDurationSeconds: 2,
        apps: [
          { appId: "b.exe", processName: "B.exe", durationSeconds: 1 },
          { appId: "a.exe", processName: "A.exe", durationSeconds: 1 },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects mismatched totals and private fields", () => {
    expect(
      appUsageSnapshotSchema.safeParse({
        ...validPublicSnapshot,
        trackedDurationSeconds: 1,
      }).success,
    ).toBe(false);
    expect(
      appUsageSnapshotSchema.safeParse({
        ...validPublicSnapshot,
        windowTitle: "private title",
      }).success,
    ).toBe(false);
  });
});
