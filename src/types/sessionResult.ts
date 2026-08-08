import type { ActivityCategory } from "./activity";
import type { MoneyBreakdown } from "./money";

export type MeasurementStatus =
  | "idle"
  | "running"
  | "stopped"
  | "finalizing"
  | "finalized"
  | "failed";

export const SESSION_RESULT_SCHEMA_VERSION = 1 as const;

export type SessionFinalizationErrorCode =
  | "TRACKING_STOP_FAILED"
  | "SETTINGS_LOAD_FAILED"
  | "CATEGORY_LOAD_FAILED"
  | "BUILD_FAILED";

export type RunningMeasurement = Readonly<{
  sessionId: string;
  /** Unix epoch milliseconds. */
  startedAt: number;
}>;

export type StoppedMeasurement = Readonly<{
  sessionId: string;
  /** Unix epoch milliseconds. */
  startedAt: number;
  /** Unix epoch milliseconds, fixed by the first stop request. */
  endedAt: number;
  /** Number of completed seconds between startedAt and endedAt. */
  durationSeconds: number;
}>;

export type SessionAppResult = Readonly<{
  appId: string;
  processName: string;
  /** Completed seconds allocated to this app. */
  durationSeconds: number;
  /** null means that no classification source resolved this app. */
  category: ActivityCategory | null;
  /** The hourly rate snapshot used during finalization. */
  hourlyRateYen: number;
  money: MoneyBreakdown;
}>;

export type SessionResult = Readonly<{
  schemaVersion: typeof SESSION_RESULT_SCHEMA_VERSION;
  sessionId: string;
  /** Unix epoch milliseconds. */
  startedAt: number;
  /** Unix epoch milliseconds fixed by the first stop request. */
  endedAt: number;
  /** Number of completed seconds between startedAt and endedAt. */
  durationSeconds: number;
  trackedDurationSeconds: number;
  untrackedDurationSeconds: number;
  apps: ReadonlyArray<SessionAppResult>;
  totals: MoneyBreakdown;
}>;
