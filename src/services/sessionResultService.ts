import type { ActivityCategory } from "../types/activity";
import type { AppUsageSnapshot } from "../types/appUsageTracking";
import type { HourlyRateSettings } from "../types/hourlyRateSettings";
import type {
  RunningMeasurement,
  SessionResult,
  StoppedMeasurement,
} from "../types/sessionResult";
import { appUsageSnapshotSchema } from "../utils/appUsageTrackingSchemas";
import { hourlyRateSettingsSchema } from "../utils/hourlyRateSettingsSchemas";
import { sessionResultSchema } from "../utils/sessionResultSchemas";
import {
  aggregateMoneyBreakdowns,
  calculateMoneyBreakdown,
} from "./moneyCalculationService";
import { resolveHourlyRateYen } from "./hourlyRateSettingsService";

export type SessionIdGenerator = () => string;

export type MeasurementLifecycleErrorCode =
  | "INVALID_TIMESTAMP"
  | "INVALID_SESSION_ID"
  | "END_BEFORE_START"
  | "MEASUREMENT_NOT_RUNNING"
  | "INVALID_MEASUREMENT_TRANSITION"
  | "INCONSISTENT_MEASUREMENT_STATE";

export type SessionResultBuildErrorCode =
  | "INVALID_APP_USAGE_SNAPSHOT"
  | "SESSION_ID_MISMATCH"
  | "START_BOUNDARY_MISMATCH"
  | "END_BOUNDARY_MISMATCH"
  | "DURATION_MISMATCH"
  | "INVALID_CATEGORY_SNAPSHOT";

export class MeasurementLifecycleError extends Error {
  constructor(
    public readonly code: MeasurementLifecycleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MeasurementLifecycleError";
  }
}

export class SessionResultBuildError extends Error {
  constructor(
    public readonly code: SessionResultBuildErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SessionResultBuildError";
  }
}

export type SessionResultBuildInput = Readonly<{
  stoppedMeasurement: StoppedMeasurement;
  appUsageSnapshot: AppUsageSnapshot;
  hourlyRateSettings: HourlyRateSettings;
  categories: ReadonlyMap<string, ActivityCategory | null>;
}>;

export const generateSessionId: SessionIdGenerator = () =>
  globalThis.crypto.randomUUID();

function assertEpochMilliseconds(value: number, fieldName: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new MeasurementLifecycleError(
      "INVALID_TIMESTAMP",
      `${fieldName} must be a non-negative integer in epoch milliseconds`,
    );
  }
}

export function createRunningMeasurement(
  startedAt: number,
  generateId: SessionIdGenerator = generateSessionId,
): RunningMeasurement {
  assertEpochMilliseconds(startedAt, "startedAt");

  const sessionId = generateId();
  if (sessionId.trim().length === 0) {
    throw new MeasurementLifecycleError(
      "INVALID_SESSION_ID",
      "sessionId must not be empty",
    );
  }

  return Object.freeze({ sessionId, startedAt });
}

export function createStoppedMeasurement(
  runningMeasurement: RunningMeasurement,
  endedAt: number,
): StoppedMeasurement {
  assertEpochMilliseconds(runningMeasurement.startedAt, "startedAt");
  assertEpochMilliseconds(endedAt, "endedAt");

  if (endedAt < runningMeasurement.startedAt) {
    throw new MeasurementLifecycleError(
      "END_BEFORE_START",
      "endedAt must not be earlier than startedAt",
    );
  }

  return Object.freeze({
    ...runningMeasurement,
    endedAt,
    durationSeconds: Math.floor(
      (endedAt - runningMeasurement.startedAt) / 1000,
    ),
  });
}

function assertSameBoundary(
  stoppedMeasurement: StoppedMeasurement,
  appUsageSnapshot: AppUsageSnapshot,
): void {
  if (stoppedMeasurement.sessionId !== appUsageSnapshot.sessionId) {
    throw new SessionResultBuildError(
      "SESSION_ID_MISMATCH",
      "session ID must match the stopped measurement",
    );
  }
  if (stoppedMeasurement.startedAt !== appUsageSnapshot.startedAt) {
    throw new SessionResultBuildError(
      "START_BOUNDARY_MISMATCH",
      "start boundary must match the stopped measurement",
    );
  }
  if (stoppedMeasurement.endedAt !== appUsageSnapshot.capturedAt) {
    throw new SessionResultBuildError(
      "END_BOUNDARY_MISMATCH",
      "end boundary must match the stopped measurement",
    );
  }
  if (
    stoppedMeasurement.durationSeconds !== appUsageSnapshot.durationSeconds
  ) {
    throw new SessionResultBuildError(
      "DURATION_MISMATCH",
      "duration must match the stopped measurement",
    );
  }
}

function assertCategorySnapshot(
  categories: ReadonlyMap<string, ActivityCategory | null>,
): void {
  for (const category of categories.values()) {
    if (
      category !== null &&
      category !== "productive" &&
      category !== "waste" &&
      category !== "neutral"
    ) {
      throw new SessionResultBuildError(
        "INVALID_CATEGORY_SNAPSHOT",
        "category snapshot contains an invalid category",
      );
    }
  }
}

function freezeSessionResult(result: SessionResult): SessionResult {
  const apps = Object.freeze(
    result.apps.map((app) =>
      Object.freeze({
        ...app,
        money: Object.freeze({ ...app.money }),
      }),
    ),
  );

  return Object.freeze({
    ...result,
    apps,
    totals: Object.freeze({ ...result.totals }),
  });
}

export function buildSessionResult(
  input: SessionResultBuildInput,
): SessionResult {
  const parsedSnapshot = appUsageSnapshotSchema.safeParse(
    input.appUsageSnapshot,
  );
  if (!parsedSnapshot.success) {
    throw new SessionResultBuildError(
      "INVALID_APP_USAGE_SNAPSHOT",
      "app usage snapshot is invalid",
    );
  }
  const parsedSettings = hourlyRateSettingsSchema.parse(
    input.hourlyRateSettings,
  );

  assertSameBoundary(input.stoppedMeasurement, parsedSnapshot.data);
  assertCategorySnapshot(input.categories);

  const apps = parsedSnapshot.data.apps.map((app) => {
    const category = input.categories.get(app.appId) ?? null;
    const hourlyRateYen = resolveHourlyRateYen(app.processName, parsedSettings);
    const money = calculateMoneyBreakdown({
      durationSeconds: app.durationSeconds,
      hourlyRateYen,
      category,
    });

    return {
      appId: app.appId,
      processName: app.processName,
      durationSeconds: app.durationSeconds,
      category,
      hourlyRateYen,
      money,
    };
  });
  const totals = aggregateMoneyBreakdowns(apps.map((app) => app.money));

  const result = sessionResultSchema.parse({
    schemaVersion: 1,
    sessionId: input.stoppedMeasurement.sessionId,
    startedAt: input.stoppedMeasurement.startedAt,
    endedAt: input.stoppedMeasurement.endedAt,
    durationSeconds: input.stoppedMeasurement.durationSeconds,
    trackedDurationSeconds: parsedSnapshot.data.trackedDurationSeconds,
    untrackedDurationSeconds: parsedSnapshot.data.untrackedDurationSeconds,
    apps,
    totals,
  });

  return freezeSessionResult(result);
}
