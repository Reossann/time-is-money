import type {
  RunningMeasurement,
  StoppedMeasurement,
} from "../types/sessionResult";

export type SessionIdGenerator = () => string;

export type MeasurementLifecycleErrorCode =
  | "INVALID_TIMESTAMP"
  | "INVALID_SESSION_ID"
  | "END_BEFORE_START"
  | "MEASUREMENT_NOT_RUNNING"
  | "INVALID_MEASUREMENT_TRANSITION"
  | "INCONSISTENT_MEASUREMENT_STATE";

export class MeasurementLifecycleError extends Error {
  constructor(
    public readonly code: MeasurementLifecycleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MeasurementLifecycleError";
  }
}

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
