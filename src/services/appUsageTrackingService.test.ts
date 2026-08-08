import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import sharedFixture from "../../fixtures/contracts/app-usage-snapshot-v1.json";
import type { AppUsageSnapshotWire } from "../utils/appUsageTrackingSchemas";
import {
  createAppUsageSnapshot,
  getAppUsageTrackingErrorCode,
  getAppUsageTrackingSnapshot,
  startAppUsageTracking,
  stopAppUsageTracking,
} from "./appUsageTrackingService";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

function wireSnapshot(
  overrides: Partial<AppUsageSnapshotWire> = {},
): AppUsageSnapshotWire {
  return {
    schemaVersion: 1,
    sessionId: "session-a",
    startedAt: 1_000,
    capturedAt: 4_000,
    durationMilliseconds: 3_000,
    trackedDurationMilliseconds: 3_000,
    untrackedDurationMilliseconds: 0,
    apps: [{ processName: "Code.exe", durationMilliseconds: 3_000 }],
    ...overrides,
  };
}

describe("app usage tracking Commands", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("starts tracking with the camelCase Command arguments", async () => {
    invokeMock.mockResolvedValue(undefined);

    await expect(startAppUsageTracking("session-a", 1_000)).resolves.toBeUndefined();
    expect(invokeMock).toHaveBeenCalledWith("start_app_usage_tracking", {
      sessionId: "session-a",
      startedAt: 1_000,
    });
  });

  it("gets and stops tracking with the intended Command names", async () => {
    invokeMock.mockResolvedValue(sharedFixture);

    const preview = await getAppUsageTrackingSnapshot("session-a", 4_500);
    const stopped = await stopAppUsageTracking("session-a", 4_500);

    expect(preview).toEqual(stopped);
    expect(invokeMock).toHaveBeenNthCalledWith(
      1,
      "get_app_usage_tracking_snapshot",
      { sessionId: "session-a", capturedAt: 4_500 },
    );
    expect(invokeMock).toHaveBeenNthCalledWith(2, "stop_app_usage_tracking", {
      sessionId: "session-a",
      endedAt: 4_500,
    });
  });

  it("rejects invalid request values before invoking Rust", async () => {
    await expect(startAppUsageTracking("  ", 1_000)).rejects.toThrow();
    await expect(
      getAppUsageTrackingSnapshot("session-a", Number.MAX_SAFE_INTEGER + 1),
    ).rejects.toThrow();
    await expect(stopAppUsageTracking("session-a", -1)).rejects.toThrow();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("preserves a stable Tauri Command error", async () => {
    const commandError = { code: "TRACKING_ALREADY_RUNNING" } as const;
    invokeMock.mockRejectedValue(commandError);

    await expect(startAppUsageTracking("session-a", 1_000)).rejects.toBe(
      commandError,
    );
  });

  it("exposes only an allow-listed error code", () => {
    expect(
      getAppUsageTrackingErrorCode({ code: "SESSION_MISMATCH" }),
    ).toBe("SESSION_MISMATCH");
    expect(
      getAppUsageTrackingErrorCode({
        code: "SESSION_MISMATCH",
        windowTitle: "private title",
      }),
    ).toBe("INTERNAL");
    expect(getAppUsageTrackingErrorCode(new Error("private path"))).toBe(
      "INTERNAL",
    );
  });
});

describe("createAppUsageSnapshot", () => {
  it("parses the shared fixture, merges case variants, and floors after merge", () => {
    const snapshot = createAppUsageSnapshot(sharedFixture);

    expect(snapshot).toEqual({
      schemaVersion: 1,
      sessionId: sharedFixture.sessionId,
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
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.apps)).toBe(true);
    expect(Object.isFrozen(snapshot.apps[0])).toBe(true);
  });

  it("merges NFC and case variants with the #52 normalizer", () => {
    const snapshot = createAppUsageSnapshot(
      wireSnapshot({
        capturedAt: 3_200,
        durationMilliseconds: 2_200,
        trackedDurationMilliseconds: 1_200,
        untrackedDurationMilliseconds: 1_000,
        apps: [
          { processName: "Cafe\u0301.exe", durationMilliseconds: 600 },
          { processName: "CAFÉ.EXE", durationMilliseconds: 600 },
        ],
      }),
    );

    expect(snapshot.apps).toEqual([
      {
        appId: "café.exe",
        processName: "Café.exe",
        durationSeconds: 1,
      },
    ]);
    expect(snapshot.trackedDurationSeconds).toBe(1);
    expect(snapshot.untrackedDurationSeconds).toBe(1);
  });

  it("returns invalid process durations and subsecond entries to untracked", () => {
    const snapshot = createAppUsageSnapshot(
      wireSnapshot({
        apps: [
          { processName: "Code.exe", durationMilliseconds: 1_500 },
          {
            processName: "C:/private/secret.exe",
            durationMilliseconds: 1_500,
          },
        ],
      }),
    );

    expect(snapshot.apps).toEqual([
      { appId: "code.exe", processName: "Code.exe", durationSeconds: 1 },
    ]);
    expect(snapshot.trackedDurationSeconds).toBe(1);
    expect(snapshot.untrackedDurationSeconds).toBe(2);

    const subsecond = createAppUsageSnapshot(
      wireSnapshot({
        capturedAt: 2_000,
        durationMilliseconds: 1_000,
        trackedDurationMilliseconds: 999,
        untrackedDurationMilliseconds: 1,
        apps: [{ processName: "Code.exe", durationMilliseconds: 999 }],
      }),
    );
    expect(subsecond.apps).toEqual([]);
    expect(subsecond.trackedDurationSeconds).toBe(0);
    expect(subsecond.untrackedDurationSeconds).toBe(1);
  });

  it("sorts apps by duration descending and appId ascending", () => {
    const snapshot = createAppUsageSnapshot(
      wireSnapshot({
        capturedAt: 6_000,
        durationMilliseconds: 5_000,
        trackedDurationMilliseconds: 5_000,
        apps: [
          { processName: "B.exe", durationMilliseconds: 1_000 },
          { processName: "C.exe", durationMilliseconds: 3_000 },
          { processName: "A.exe", durationMilliseconds: 1_000 },
        ],
      }),
    );

    expect(snapshot.apps.map((app) => app.appId)).toEqual([
      "c.exe",
      "a.exe",
      "b.exe",
    ]);
  });

  it("rejects invalid wire totals and private fields", () => {
    expect(() =>
      createAppUsageSnapshot(
        wireSnapshot({ trackedDurationMilliseconds: 2_999 }),
      ),
    ).toThrow();
    expect(() =>
      createAppUsageSnapshot({ ...wireSnapshot(), processId: 42 }),
    ).toThrow();
  });
});
