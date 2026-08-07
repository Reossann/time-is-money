import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

import {
  APP_USAGE_SNAPSHOT_SCHEMA_VERSION,
  type AppUsageSnapshot,
  type TrackedAppUsage,
} from "../types/appUsageTracking";
import {
  appUsageSnapshotSchema,
  appUsageSnapshotWireSchema,
  nonnegativeSafeIntegerSchema,
  type AppUsageSnapshotWire,
} from "../utils/appUsageTrackingSchemas";
import {
  createNormalizedDesktopAppId,
  normalizeDesktopProcessName,
} from "../utils/hourlyRateSettingsSchemas";

const trackingIdentitySchema = z
  .object({
    sessionId: z.string().refine((value) => value.trim().length > 0, {
      message: "sessionId must not be empty",
    }),
    startedAt: nonnegativeSafeIntegerSchema,
  })
  .strict();

const trackingSnapshotRequestSchema = z
  .object({
    sessionId: trackingIdentitySchema.shape.sessionId,
    capturedAt: nonnegativeSafeIntegerSchema,
  })
  .strict();

const trackingStopRequestSchema = z
  .object({
    sessionId: trackingIdentitySchema.shape.sessionId,
    endedAt: nonnegativeSafeIntegerSchema,
  })
  .strict();

type AggregatedUsage = {
  processName: string;
  durationMilliseconds: number;
};

function freezeSnapshot(snapshot: AppUsageSnapshot): AppUsageSnapshot {
  const apps = Object.freeze(
    snapshot.apps.map((app) => Object.freeze({ ...app })),
  );
  return Object.freeze({ ...snapshot, apps });
}

function compareTrackedApps(left: TrackedAppUsage, right: TrackedAppUsage) {
  if (left.durationSeconds !== right.durationSeconds) {
    return right.durationSeconds - left.durationSeconds;
  }
  if (left.appId < right.appId) return -1;
  if (left.appId > right.appId) return 1;
  return 0;
}

export function createAppUsageSnapshot(
  wireValue: unknown,
): AppUsageSnapshot {
  const wire = appUsageSnapshotWireSchema.parse(wireValue);
  const aggregated = new Map<string, AggregatedUsage>();

  for (const app of wire.apps) {
    let processName: string;
    let appId: string;
    try {
      processName = normalizeDesktopProcessName(app.processName);
      appId = createNormalizedDesktopAppId(processName);
    } catch {
      continue;
    }

    const current = aggregated.get(appId);
    if (current === undefined) {
      aggregated.set(appId, {
        processName,
        durationMilliseconds: app.durationMilliseconds,
      });
    } else {
      current.durationMilliseconds += app.durationMilliseconds;
    }
  }

  const apps = Array.from(aggregated, ([appId, app]) => ({
    appId,
    processName: app.processName,
    durationSeconds: Math.floor(app.durationMilliseconds / 1_000),
  }))
    .filter((app) => app.durationSeconds > 0)
    .sort(compareTrackedApps);
  const durationSeconds = Math.floor(wire.durationMilliseconds / 1_000);
  const trackedDurationSeconds = apps.reduce(
    (sum, app) => sum + app.durationSeconds,
    0,
  );

  const snapshot = appUsageSnapshotSchema.parse({
    schemaVersion: APP_USAGE_SNAPSHOT_SCHEMA_VERSION,
    sessionId: wire.sessionId,
    startedAt: wire.startedAt,
    capturedAt: wire.capturedAt,
    durationSeconds,
    trackedDurationSeconds,
    untrackedDurationSeconds: durationSeconds - trackedDurationSeconds,
    apps,
  });
  return freezeSnapshot(snapshot);
}

export async function startAppUsageTracking(
  sessionId: string,
  startedAt: number,
): Promise<void> {
  const args = trackingIdentitySchema.parse({ sessionId, startedAt });
  await invoke<void>("start_app_usage_tracking", args);
}

export async function getAppUsageTrackingSnapshot(
  sessionId: string,
  capturedAt: number,
): Promise<AppUsageSnapshot> {
  const args = trackingSnapshotRequestSchema.parse({ sessionId, capturedAt });
  const wire = await invoke<AppUsageSnapshotWire>(
    "get_app_usage_tracking_snapshot",
    args,
  );
  return createAppUsageSnapshot(wire);
}

export async function stopAppUsageTracking(
  sessionId: string,
  endedAt: number,
): Promise<AppUsageSnapshot> {
  const args = trackingStopRequestSchema.parse({ sessionId, endedAt });
  const wire = await invoke<AppUsageSnapshotWire>(
    "stop_app_usage_tracking",
    args,
  );
  return createAppUsageSnapshot(wire);
}
