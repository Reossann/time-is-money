import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultHourlyRateSettings } from "./hourlyRateSettingsService";
import {
  configureSessionFinalizationControllerForTests,
  createSessionCategoryProvider,
  getFinalizedSessionResult,
  resetSessionFinalizationControllerForTests,
  retrySessionFinalization,
  stopAndFinalizeMeasurement,
} from "./sessionFinalizationController";
import {
  createDefaultAppCategorySettings,
  setAppCategory,
} from "./appCategorySettingsService";
import { useActivityStore } from "../stores/useActivityStore";
import type { AppUsageSnapshot } from "../types/appUsageTracking";
import type { SessionResult } from "../types/sessionResult";

const SESSION_ID = "00000000-0000-4000-8000-000000000001";

const snapshot: AppUsageSnapshot = Object.freeze({
  schemaVersion: 1,
  sessionId: SESSION_ID,
  startedAt: 1_000,
  capturedAt: 4_000,
  durationSeconds: 3,
  trackedDurationSeconds: 2,
  untrackedDurationSeconds: 1,
  apps: Object.freeze([
    Object.freeze({
      appId: "code.exe",
      processName: "Code.exe",
      durationSeconds: 2,
    }),
  ]),
});

const result: SessionResult = Object.freeze({
  schemaVersion: 1,
  sessionId: SESSION_ID,
  startedAt: 1_000,
  endedAt: 4_000,
  durationSeconds: 3,
  trackedDurationSeconds: 2,
  untrackedDurationSeconds: 1,
  apps: Object.freeze([
    Object.freeze({
      appId: "code.exe",
      processName: "Code.exe",
      durationSeconds: 2,
      category: null,
      hourlyRateYen: 0,
      money: Object.freeze({ earnedYen: 0, wastedYen: 0, netYen: 0 }),
    }),
  ]),
  totals: Object.freeze({ earnedYen: 0, wastedYen: 0, netYen: 0 }),
});

function resetActivityStore(): void {
  useActivityStore.setState({
    elapsedSeconds: 0,
    startedAt: null,
    sessionId: null,
    measurementStatus: "idle",
    stoppedMeasurement: null,
    finalizedResult: null,
    finalizationErrorCode: null,
  });
}

function startMeasurement(): void {
  useActivityStore
    .getState()
    .startMeasurement(1_000, () => SESSION_ID);
}

describe("sessionFinalizationController", () => {
  beforeEach(() => {
    resetActivityStore();
    resetSessionFinalizationControllerForTests();
  });

  it("gives result display and persistence consumers the same finalized object", async () => {
    const displayConsumer = () => getFinalizedSessionResult();
    const persistenceConsumer = () => getFinalizedSessionResult();
    configureSessionFinalizationControllerForTests({
      stopAndSnapshotAppUsage: vi.fn().mockResolvedValue(snapshot),
      hourlyRateSettingsRepository: {
        load: vi.fn().mockResolvedValue(createDefaultHourlyRateSettings()),
      },
      categoryProvider: { load: vi.fn().mockResolvedValue(new Map()) },
      buildSessionResult: () => result,
    });

    expect(displayConsumer()).toEqual({ status: "not-finalized" });
    startMeasurement();
    const finalization = stopAndFinalizeMeasurement(4_000);
    expect(displayConsumer()).toEqual({ status: "finalizing" });
    await expect(finalization).resolves.toBe(result);
    await Promise.resolve();

    const forDisplay = displayConsumer();
    const forPersistence = persistenceConsumer();
    expect(forDisplay).toMatchObject({ status: "finalized", result });
    expect(forPersistence).toMatchObject({ status: "finalized", result });
    if (forDisplay.status !== "finalized" || forPersistence.status !== "finalized") {
      throw new Error("finalized result should be available to both consumers");
    }
    expect(forDisplay.result).toBe(result);
    expect(forPersistence.result).toBe(result);
    expect(forDisplay.result).toBe(forPersistence.result);
  });

  it("loads configured categories as the fixed finalization snapshot", async () => {
    const categorySettings = setAppCategory(
      "Code.exe",
      "productive",
      createDefaultAppCategorySettings(),
    );
    const loadCategories = vi.fn().mockResolvedValue(categorySettings);
    const categoryProvider = createSessionCategoryProvider({
      load: loadCategories,
    });
    const build = vi.fn().mockReturnValue(result);
    configureSessionFinalizationControllerForTests({
      stopAndSnapshotAppUsage: vi.fn().mockResolvedValue(snapshot),
      hourlyRateSettingsRepository: {
        load: vi.fn().mockResolvedValue(createDefaultHourlyRateSettings()),
      },
      categoryProvider,
      buildSessionResult: build,
    });
    startMeasurement();

    await expect(stopAndFinalizeMeasurement(4_000)).resolves.toBe(result);
    await Promise.resolve();

    expect(loadCategories).toHaveBeenCalledOnce();
    expect(build).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: new Map([["code.exe", "productive"]]),
      }),
    );
  });

  it("shares first stop, context loading, and the finalized result", async () => {
    const stopAndSnapshot = vi.fn().mockResolvedValue(snapshot);
    const loadSettings = vi
      .fn()
      .mockResolvedValue(createDefaultHourlyRateSettings());
    const loadCategories = vi.fn().mockResolvedValue(new Map());
    const build = vi.fn().mockReturnValue(result);
    configureSessionFinalizationControllerForTests({
      stopAndSnapshotAppUsage: stopAndSnapshot,
      hourlyRateSettingsRepository: { load: loadSettings },
      categoryProvider: { load: loadCategories },
      buildSessionResult: build,
    });
    startMeasurement();

    const first = stopAndFinalizeMeasurement(4_000);
    const duplicate = stopAndFinalizeMeasurement(9_000);

    expect(duplicate).toBe(first);
    await expect(first).resolves.toBe(result);
    await Promise.resolve();

    expect(stopAndSnapshot).toHaveBeenCalledOnce();
    expect(stopAndSnapshot).toHaveBeenCalledWith(4_000);
    expect(loadSettings).toHaveBeenCalledOnce();
    expect(loadCategories).toHaveBeenCalledOnce();
    expect(build).toHaveBeenCalledOnce();
    expect(useActivityStore.getState()).toMatchObject({
      measurementStatus: "finalized",
      stoppedMeasurement: {
        sessionId: SESSION_ID,
        startedAt: 1_000,
        endedAt: 4_000,
      },
      finalizedResult: result,
      finalizationErrorCode: null,
    });
    await expect(stopAndFinalizeMeasurement(20_000)).resolves.toBe(result);
    expect(stopAndSnapshot).toHaveBeenCalledOnce();
    expect(build).toHaveBeenCalledOnce();
  });

  it("retries a failed settings load with the fixed boundary and cached snapshot", async () => {
    const stopAndSnapshot = vi.fn().mockResolvedValue(snapshot);
    const loadSettings = vi
      .fn()
      .mockRejectedValueOnce(new Error("private settings"))
      .mockResolvedValueOnce(createDefaultHourlyRateSettings());
    const loadCategories = vi.fn().mockResolvedValue(new Map());
    configureSessionFinalizationControllerForTests({
      stopAndSnapshotAppUsage: stopAndSnapshot,
      hourlyRateSettingsRepository: { load: loadSettings },
      categoryProvider: { load: loadCategories },
      buildSessionResult: () => result,
    });
    startMeasurement();

    await expect(stopAndFinalizeMeasurement(4_000)).rejects.toMatchObject({
      code: "SETTINGS_LOAD_FAILED",
    });
    await Promise.resolve();
    expect(useActivityStore.getState()).toMatchObject({
      measurementStatus: "failed",
      finalizationErrorCode: "SETTINGS_LOAD_FAILED",
      stoppedMeasurement: { endedAt: 4_000 },
      finalizedResult: null,
    });
    expect(getFinalizedSessionResult()).toEqual({
      status: "failed",
      errorCode: "SETTINGS_LOAD_FAILED",
    });

    await expect(retrySessionFinalization()).resolves.toBe(result);
    expect(stopAndSnapshot).toHaveBeenCalledOnce();
    expect(loadSettings).toHaveBeenCalledTimes(2);
    expect(loadCategories).toHaveBeenCalledOnce();
  });

  it("maps a failed tracking stop to a safe code and retries it", async () => {
    const stopAndSnapshot = vi
      .fn()
      .mockRejectedValueOnce({ code: "INTERNAL", detail: "private" })
      .mockResolvedValueOnce(snapshot);
    const loadSettings = vi
      .fn()
      .mockResolvedValue(createDefaultHourlyRateSettings());
    const loadCategories = vi.fn().mockResolvedValue(new Map());
    configureSessionFinalizationControllerForTests({
      stopAndSnapshotAppUsage: stopAndSnapshot,
      hourlyRateSettingsRepository: { load: loadSettings },
      categoryProvider: { load: loadCategories },
      buildSessionResult: () => result,
    });
    startMeasurement();

    await expect(stopAndFinalizeMeasurement(4_000)).rejects.toMatchObject({
      code: "TRACKING_STOP_FAILED",
    });
    await expect(retrySessionFinalization()).resolves.toBe(result);

    expect(stopAndSnapshot).toHaveBeenCalledTimes(2);
    expect(stopAndSnapshot).toHaveBeenLastCalledWith(4_000);
    expect(loadSettings).toHaveBeenCalledOnce();
    expect(loadCategories).toHaveBeenCalledOnce();
  });

  it("maps a builder failure without storing the raw error", async () => {
    const privateError = new Error("window title: private title");
    const build = vi
      .fn()
      .mockImplementationOnce(() => {
        throw privateError;
      })
      .mockReturnValueOnce(result);
    configureSessionFinalizationControllerForTests({
      stopAndSnapshotAppUsage: vi.fn().mockResolvedValue(snapshot),
      hourlyRateSettingsRepository: {
        load: vi.fn().mockResolvedValue(createDefaultHourlyRateSettings()),
      },
      categoryProvider: { load: vi.fn().mockResolvedValue(new Map()) },
      buildSessionResult: build,
    });
    startMeasurement();

    await expect(stopAndFinalizeMeasurement(4_000)).rejects.toMatchObject({
      code: "BUILD_FAILED",
    });
    await Promise.resolve();
    expect(useActivityStore.getState()).toMatchObject({
      measurementStatus: "failed",
      finalizationErrorCode: "BUILD_FAILED",
      finalizedResult: null,
    });
    expect(JSON.stringify(useActivityStore.getState())).not.toContain(
      privateError.message,
    );

    await expect(retrySessionFinalization()).resolves.toBe(result);
    expect(build).toHaveBeenCalledTimes(2);
  });
});
