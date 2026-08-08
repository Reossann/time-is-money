import {
  hourlyRateSettingsRepository,
  type HourlyRateSettingsRepository,
} from "../repositories/hourlyRateSettingsRepository";
import { stopAndSnapshotAppUsage } from "../hooks/useMeasurementTracking";
import { useActivityStore } from "../stores/useActivityStore";
import type { ActivityCategory } from "../types/activity";
import type { HourlyRateSettings } from "../types/hourlyRateSettings";
import type {
  SessionFinalizationErrorCode,
  SessionResult,
  StoppedMeasurement,
} from "../types/sessionResult";
import { hourlyRateSettingsSchema } from "../utils/hourlyRateSettingsSchemas";
import {
  buildSessionResult,
  type SessionResultBuildInput,
} from "./sessionResultService";

export interface SessionCategoryProvider {
  load(): Promise<ReadonlyMap<string, ActivityCategory | null>>;
}

export type SessionFinalizationControllerErrorCode =
  | SessionFinalizationErrorCode
  | "SESSION_MISMATCH";

export class SessionFinalizationControllerError extends Error {
  constructor(
    public readonly code: SessionFinalizationControllerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SessionFinalizationControllerError";
  }
}

export type FinalizedSessionResultState =
  | Readonly<{ status: "not-finalized" }>
  | Readonly<{ status: "finalizing" }>
  | Readonly<{
      status: "failed";
      errorCode: SessionFinalizationErrorCode;
    }>
  | Readonly<{ status: "finalized"; result: SessionResult }>;

type ControllerDependencies = Readonly<{
  stopAndSnapshotAppUsage: (endedAt: number) => Promise<
    SessionResultBuildInput["appUsageSnapshot"]
  >;
  hourlyRateSettingsRepository: Pick<HourlyRateSettingsRepository, "load">;
  categoryProvider: SessionCategoryProvider;
  buildSessionResult: (input: SessionResultBuildInput) => SessionResult;
}>;

type FinalizationController = {
  stoppedMeasurement: StoppedMeasurement;
  finalizationPromise: Promise<SessionResult> | null;
  finalizedResult: SessionResult | null;
  finalizationErrorCode: SessionFinalizationErrorCode | null;
  appUsageSnapshot: SessionResultBuildInput["appUsageSnapshot"] | null;
  appUsageSnapshotPromise: Promise<
    SessionResultBuildInput["appUsageSnapshot"]
  > | null;
  hourlyRateSettings: HourlyRateSettings | null;
  hourlyRateSettingsPromise: Promise<HourlyRateSettings> | null;
  categories: ReadonlyMap<string, ActivityCategory | null> | null;
  categoriesPromise: Promise<ReadonlyMap<string, ActivityCategory | null>> | null;
};

const emptyCategoryProvider: SessionCategoryProvider = Object.freeze({
  load: async () => new Map(),
});

const defaultDependencies: ControllerDependencies = {
  stopAndSnapshotAppUsage,
  hourlyRateSettingsRepository,
  categoryProvider: emptyCategoryProvider,
  buildSessionResult,
};

let dependencies = defaultDependencies;
let controller: FinalizationController | null = null;

function createControllerError(
  code: SessionFinalizationControllerErrorCode,
): SessionFinalizationControllerError {
  const messages: Record<SessionFinalizationControllerErrorCode, string> = {
    TRACKING_STOP_FAILED: "App usage tracking could not be stopped",
    SETTINGS_LOAD_FAILED: "Hourly rate settings could not be loaded",
    CATEGORY_LOAD_FAILED: "Categories could not be loaded",
    BUILD_FAILED: "Session result could not be finalized",
    SESSION_MISMATCH: "Session finalization does not match the stopped session",
  };

  return new SessionFinalizationControllerError(code, messages[code]);
}

function matchesStoppedMeasurement(
  left: StoppedMeasurement,
  right: StoppedMeasurement,
): boolean {
  return (
    left.sessionId === right.sessionId &&
    left.startedAt === right.startedAt &&
    left.endedAt === right.endedAt &&
    left.durationSeconds === right.durationSeconds
  );
}

function freezeSettings(settings: HourlyRateSettings): HourlyRateSettings {
  const parsed = hourlyRateSettingsSchema.parse(settings);
  return Object.freeze({
    schemaVersion: parsed.schemaVersion,
    defaultHourlyRateYen: parsed.defaultHourlyRateYen,
    desktopApps: Object.freeze(
      parsed.desktopApps.map((entry) => Object.freeze({ ...entry })),
    ),
  });
}

function cloneCategories(
  categories: ReadonlyMap<string, ActivityCategory | null>,
): ReadonlyMap<string, ActivityCategory | null> {
  return new Map(categories);
}

function loadHourlyRateSettings(
  activeController: FinalizationController,
): Promise<HourlyRateSettings> {
  if (activeController.hourlyRateSettings !== null) {
    return Promise.resolve(activeController.hourlyRateSettings);
  }
  if (activeController.hourlyRateSettingsPromise !== null) {
    return activeController.hourlyRateSettingsPromise;
  }

  const promise = dependencies.hourlyRateSettingsRepository.load().then(
    (settings) => {
      const frozenSettings = freezeSettings(settings);
      activeController.hourlyRateSettings = frozenSettings;
      return frozenSettings;
    },
    () => {
      activeController.hourlyRateSettingsPromise = null;
      throw createControllerError("SETTINGS_LOAD_FAILED");
    },
  );
  activeController.hourlyRateSettingsPromise = promise;
  return promise;
}

function loadAppUsageSnapshot(
  activeController: FinalizationController,
): Promise<SessionResultBuildInput["appUsageSnapshot"]> {
  if (activeController.appUsageSnapshot !== null) {
    return Promise.resolve(activeController.appUsageSnapshot);
  }
  if (activeController.appUsageSnapshotPromise !== null) {
    return activeController.appUsageSnapshotPromise;
  }

  const promise = dependencies
    .stopAndSnapshotAppUsage(activeController.stoppedMeasurement.endedAt)
    .then(
      (snapshot) => {
        activeController.appUsageSnapshot = snapshot;
        return snapshot;
      },
      () => {
        activeController.appUsageSnapshotPromise = null;
        throw createControllerError("TRACKING_STOP_FAILED");
      },
    );
  activeController.appUsageSnapshotPromise = promise;
  return promise;
}

function loadCategories(
  activeController: FinalizationController,
): Promise<ReadonlyMap<string, ActivityCategory | null>> {
  if (activeController.categories !== null) {
    return Promise.resolve(activeController.categories);
  }
  if (activeController.categoriesPromise !== null) {
    return activeController.categoriesPromise;
  }

  const promise = dependencies.categoryProvider.load().then(
    (categories) => {
      const copiedCategories = cloneCategories(categories);
      activeController.categories = copiedCategories;
      return copiedCategories;
    },
    () => {
      activeController.categoriesPromise = null;
      throw createControllerError("CATEGORY_LOAD_FAILED");
    },
  );
  activeController.categoriesPromise = promise;
  return promise;
}

function startFinalization(
  activeController: FinalizationController,
): Promise<SessionResult> {
  if (activeController.finalizedResult !== null) {
    return Promise.resolve(activeController.finalizedResult);
  }
  if (activeController.finalizationPromise !== null) {
    return activeController.finalizationPromise;
  }

  useActivityStore.getState().markFinalizing();
  activeController.finalizationErrorCode = null;
  const stoppedMeasurement = activeController.stoppedMeasurement;
  const finalizationPromise = Promise.all([
    loadAppUsageSnapshot(activeController),
    loadHourlyRateSettings(activeController),
    loadCategories(activeController),
  ]).then(
    ([snapshot, hourlyRateSettings, categories]) => {
      try {
        return dependencies.buildSessionResult({
          stoppedMeasurement,
          appUsageSnapshot: snapshot,
          hourlyRateSettings,
          categories,
        });
      } catch {
        throw createControllerError("BUILD_FAILED");
      }
    },
  );
  activeController.finalizationPromise = finalizationPromise;

  void finalizationPromise.then(
    (result) => {
      if (controller !== activeController) return;

      activeController.finalizedResult = result;
      activeController.finalizationPromise = null;
      activeController.finalizationErrorCode = null;
      useActivityStore.getState().markFinalized(result);
    },
    (error: unknown) => {
      if (controller !== activeController) return;

      activeController.finalizationPromise = null;
      const errorCode: SessionFinalizationErrorCode =
        error instanceof SessionFinalizationControllerError &&
        error.code !== "SESSION_MISMATCH"
          ? error.code
          : "BUILD_FAILED";
      activeController.finalizationErrorCode = errorCode;
      useActivityStore.getState().markFinalizationFailed(errorCode);
    },
  );

  return finalizationPromise;
}

export function stopAndFinalizeMeasurement(
  endedAt?: number,
): Promise<SessionResult> {
  const stoppedMeasurement = useActivityStore
    .getState()
    .stopMeasurement(endedAt);

  if (controller === null) {
    controller = {
      stoppedMeasurement,
      finalizationPromise: null,
      finalizedResult: null,
      finalizationErrorCode: null,
      appUsageSnapshot: null,
      appUsageSnapshotPromise: null,
      hourlyRateSettings: null,
      hourlyRateSettingsPromise: null,
      categories: null,
      categoriesPromise: null,
    };
  } else if (!matchesStoppedMeasurement(controller.stoppedMeasurement, stoppedMeasurement)) {
    return Promise.reject(createControllerError("SESSION_MISMATCH"));
  }

  return startFinalization(controller);
}

export function retrySessionFinalization(): Promise<SessionResult> {
  if (controller === null) {
    return Promise.reject(createControllerError("SESSION_MISMATCH"));
  }

  return startFinalization(controller);
}

/**
 * Returns the one finalized snapshot for consumers such as result display and
 * persistence. This boundary never rebuilds a result from the live store.
 */
export function getFinalizedSessionResult(): FinalizedSessionResultState {
  if (controller === null) {
    return Object.freeze({ status: "not-finalized" });
  }
  if (controller.finalizedResult !== null) {
    return Object.freeze({ status: "finalized", result: controller.finalizedResult });
  }
  if (controller.finalizationPromise !== null) {
    return Object.freeze({ status: "finalizing" });
  }
  if (controller.finalizationErrorCode !== null) {
    return Object.freeze({
      status: "failed",
      errorCode: controller.finalizationErrorCode,
    });
  }
  return Object.freeze({ status: "not-finalized" });
}

export function resetSessionFinalizationControllerForTests(): void {
  controller = null;
  dependencies = defaultDependencies;
}

export function configureSessionFinalizationControllerForTests(
  overrides: Partial<ControllerDependencies>,
): void {
  dependencies = { ...defaultDependencies, ...overrides };
}
