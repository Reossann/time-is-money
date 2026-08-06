export type MeasurementStatus =
  | "idle"
  | "running"
  | "stopped"
  | "finalizing"
  | "finalized"
  | "failed";

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
