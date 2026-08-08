import { describe, expect, it } from "vitest";

import type { ActivityCategory } from "../types/activity";
import type { AppUsageSnapshot } from "../types/appUsageTracking";
import type { HourlyRateSettings } from "../types/hourlyRateSettings";
import {
  createDefaultHourlyRateSettings,
  registerDesktopApp,
  setAppHourlyRateYen,
  setDefaultHourlyRateYen,
} from "./hourlyRateSettingsService";
import {
  buildSessionResult,
  createRunningMeasurement,
  createStoppedMeasurement,
  SessionResultBuildError,
} from "./sessionResultService";

const SESSION_ID = "00000000-0000-4000-8000-000000000001";

describe("sessionResultService", () => {
  it("creates immutable running and stopped measurements", () => {
    const runningMeasurement = createRunningMeasurement(
      1_000,
      () => SESSION_ID,
    );
    const stoppedMeasurement = createStoppedMeasurement(
      runningMeasurement,
      2_999,
    );

    expect(runningMeasurement).toEqual({
      sessionId: SESSION_ID,
      startedAt: 1_000,
    });
    expect(stoppedMeasurement).toEqual({
      sessionId: SESSION_ID,
      startedAt: 1_000,
      endedAt: 2_999,
      durationSeconds: 1,
    });
    expect(Object.isFrozen(runningMeasurement)).toBe(true);
    expect(Object.isFrozen(stoppedMeasurement)).toBe(true);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid start timestamp %s",
    (startedAt) => {
      expect(() =>
        createRunningMeasurement(startedAt, () => SESSION_ID),
      ).toThrow(expect.objectContaining({ code: "INVALID_TIMESTAMP" }));
    },
  );

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid stop timestamp %s",
    (endedAt) => {
      const runningMeasurement = createRunningMeasurement(
        1_000,
        () => SESSION_ID,
      );

      expect(() =>
        createStoppedMeasurement(runningMeasurement, endedAt),
      ).toThrow(expect.objectContaining({ code: "INVALID_TIMESTAMP" }));
    },
  );

  it("rejects an empty generated session ID", () => {
    expect(() => createRunningMeasurement(1_000, () => "  ")).toThrow(
      expect.objectContaining({ code: "INVALID_SESSION_ID" }),
    );
  });
});

function createStoppedSession() {
  return createStoppedMeasurement(
    createRunningMeasurement(1_000, () => SESSION_ID),
    10_000,
  );
}

function createAppUsageSnapshot(): AppUsageSnapshot {
  return {
    schemaVersion: 1,
    sessionId: SESSION_ID,
    startedAt: 1_000,
    capturedAt: 10_000,
    durationSeconds: 9,
    trackedDurationSeconds: 8,
    untrackedDurationSeconds: 1,
    apps: [
      { appId: "code.exe", processName: "Code.exe", durationSeconds: 5 },
      {
        appId: "chrome.exe",
        processName: "chrome.exe",
        durationSeconds: 3,
      },
    ],
  };
}

function createHourlyRateSettings(): HourlyRateSettings {
  let settings = setDefaultHourlyRateYen(3_600, createDefaultHourlyRateSettings());
  settings = registerDesktopApp("chrome.exe", settings);
  return setAppHourlyRateYen("chrome.exe", 1_200, settings);
}

describe("buildSessionResult", () => {
  it("combines the stopped boundary, app usage, rates, and money", () => {
    const result = buildSessionResult({
      stoppedMeasurement: createStoppedSession(),
      appUsageSnapshot: createAppUsageSnapshot(),
      hourlyRateSettings: createHourlyRateSettings(),
      categories: new Map([
        ["code.exe", "productive"],
        ["chrome.exe", "waste"],
      ]),
    });

    expect(result).toEqual({
      schemaVersion: 1,
      sessionId: SESSION_ID,
      startedAt: 1_000,
      endedAt: 10_000,
      durationSeconds: 9,
      trackedDurationSeconds: 8,
      untrackedDurationSeconds: 1,
      apps: [
        {
          appId: "code.exe",
          processName: "Code.exe",
          durationSeconds: 5,
          category: "productive",
          hourlyRateYen: 3_600,
          money: { earnedYen: 5, wastedYen: 0, netYen: 5 },
        },
        {
          appId: "chrome.exe",
          processName: "chrome.exe",
          durationSeconds: 3,
          category: "waste",
          hourlyRateYen: 1_200,
          money: { earnedYen: 0, wastedYen: 1, netYen: -1 },
        },
      ],
      totals: { earnedYen: 5, wastedYen: 1, netYen: 4 },
    });
  });

  it.each(["neutral", null] as const)(
    "keeps %s classification at zero yen",
    (category) => {
      const result = buildSessionResult({
        stoppedMeasurement: createStoppedSession(),
        appUsageSnapshot: createAppUsageSnapshot(),
        hourlyRateSettings: createHourlyRateSettings(),
        categories: new Map([["code.exe", category]]),
      });

      expect(result.apps[0]?.category).toBe(category);
      expect(result.apps[0]?.money).toEqual({
        earnedYen: 0,
        wastedYen: 0,
        netYen: 0,
      });
      expect(result.apps[1]?.category).toBeNull();
      expect(result.apps[1]?.money).toEqual({
        earnedYen: 0,
        wastedYen: 0,
        netYen: 0,
      });
    },
  );

  it("uses default, explicit zero, and decimal rates from the input snapshot", () => {
    let settings = setDefaultHourlyRateYen(
      1_800,
      createDefaultHourlyRateSettings(),
    );
    settings = registerDesktopApp("chrome.exe", settings);
    settings = setAppHourlyRateYen("chrome.exe", 0, settings);

    const result = buildSessionResult({
      stoppedMeasurement: createStoppedSession(),
      appUsageSnapshot: createAppUsageSnapshot(),
      hourlyRateSettings: settings,
      categories: new Map([
        ["code.exe", "productive"],
        ["chrome.exe", "productive"],
      ]),
    });

    expect(result.apps[0]?.hourlyRateYen).toBe(1_800);
    expect(result.apps[0]?.money.earnedYen).toBe(3);
    expect(result.apps[1]?.hourlyRateYen).toBe(0);
    expect(result.apps[1]?.money.earnedYen).toBe(0);
  });

  it.each([
    ["session ID", "SESSION_ID_MISMATCH", { sessionId: "another-session" }],
    [
      "start boundary",
      "START_BOUNDARY_MISMATCH",
      {
        startedAt: 2_000,
        capturedAt: 10_000,
        durationSeconds: 8,
        untrackedDurationSeconds: 0,
      },
    ],
    [
      "end boundary",
      "END_BOUNDARY_MISMATCH",
      {
        capturedAt: 9_000,
        durationSeconds: 8,
        untrackedDurationSeconds: 0,
      },
    ],
  ] as const)("rejects a mismatched %s", (_label, code, overrides) => {
    expect(() =>
      buildSessionResult({
        stoppedMeasurement: createStoppedSession(),
        appUsageSnapshot: { ...createAppUsageSnapshot(), ...overrides },
        hourlyRateSettings: createHourlyRateSettings(),
        categories: new Map(),
      }),
    ).toThrow(expect.objectContaining({ code }));
  });

  it("rejects a duration mismatch without correcting the boundary", () => {
    const stoppedMeasurement = { ...createStoppedSession(), durationSeconds: 8 };

    expect(() =>
      buildSessionResult({
        stoppedMeasurement,
        appUsageSnapshot: createAppUsageSnapshot(),
        hourlyRateSettings: createHourlyRateSettings(),
        categories: new Map(),
      }),
    ).toThrow(expect.objectContaining({ code: "DURATION_MISMATCH" }));
  });

  it("rejects invalid category snapshots without exposing their value", () => {
    const privateCategory = "private https://example.com/title";

    try {
      buildSessionResult({
        stoppedMeasurement: createStoppedSession(),
        appUsageSnapshot: createAppUsageSnapshot(),
        hourlyRateSettings: createHourlyRateSettings(),
        categories: new Map([
          ["code.exe", privateCategory as never],
        ]),
      });
      throw new Error("expected category snapshot to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(SessionResultBuildError);
      expect(error).toMatchObject({ code: "INVALID_CATEGORY_SNAPSHOT" });
      expect((error as Error).message).not.toContain(privateCategory);
    }
  });

  it("keeps the money calculation overflow rule from #13", () => {
    const endedAt = Number.MAX_SAFE_INTEGER;
    const durationSeconds = Math.floor(endedAt / 1_000);

    expect(() =>
      buildSessionResult({
        stoppedMeasurement: {
          sessionId: SESSION_ID,
          startedAt: 0,
          endedAt,
          durationSeconds,
        },
        appUsageSnapshot: {
          schemaVersion: 1,
          sessionId: SESSION_ID,
          startedAt: 0,
          capturedAt: endedAt,
          durationSeconds,
          trackedDurationSeconds: durationSeconds,
          untrackedDurationSeconds: 0,
          apps: [
            {
              appId: "code.exe",
              processName: "Code.exe",
              durationSeconds,
            },
          ],
        },
        hourlyRateSettings: {
          schemaVersion: 1,
          defaultHourlyRateYen: Number.MAX_VALUE,
          desktopApps: [],
        },
        categories: new Map([["code.exe", "productive"]]),
      }),
    ).toThrow(expect.objectContaining({ code: "AMOUNT_OUT_OF_RANGE" }));
  });

  it("returns a deep-frozen result independent from later input changes", () => {
    const snapshot = createAppUsageSnapshot();
    const settings: HourlyRateSettings = {
      schemaVersion: 1,
      defaultHourlyRateYen: 3_600,
      desktopApps: [],
    };
    const categories = new Map<string, ActivityCategory | null>([
      ["code.exe", "productive"],
    ]);

    const result = buildSessionResult({
      stoppedMeasurement: createStoppedSession(),
      appUsageSnapshot: snapshot,
      hourlyRateSettings: settings,
      categories,
    });
    (snapshot.apps as unknown as Array<{ durationSeconds: number }>)[0]!
      .durationSeconds = 1;
    (settings as { defaultHourlyRateYen: number }).defaultHourlyRateYen = 0;
    categories.set("code.exe", "waste");

    expect(result.apps[0]?.durationSeconds).toBe(5);
    expect(result.apps[0]?.category).toBe("productive");
    expect(result.apps[0]?.money).toEqual({
      earnedYen: 5,
      wastedYen: 0,
      netYen: 5,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.apps)).toBe(true);
    expect(Object.isFrozen(result.apps[0])).toBe(true);
    expect(Object.isFrozen(result.apps[0]?.money)).toBe(true);
    expect(Object.isFrozen(result.totals)).toBe(true);
  });
});
