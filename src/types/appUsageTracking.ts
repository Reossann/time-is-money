export const APP_USAGE_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export type TrackedAppUsage = Readonly<{
  appId: string;
  processName: string;
  durationSeconds: number;
}>;

export type AppUsageSnapshot = Readonly<{
  schemaVersion: typeof APP_USAGE_SNAPSHOT_SCHEMA_VERSION;
  sessionId: string;
  /** Unix epoch milliseconds. */
  startedAt: number;
  /** Unix epoch milliseconds. Equals endedAt for a stopped session. */
  capturedAt: number;
  durationSeconds: number;
  trackedDurationSeconds: number;
  untrackedDurationSeconds: number;
  apps: ReadonlyArray<TrackedAppUsage>;
}>;
