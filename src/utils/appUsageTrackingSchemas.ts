import { z } from "zod";

import {
  APP_USAGE_SNAPSHOT_SCHEMA_VERSION,
  type AppUsageSnapshot,
} from "../types/appUsageTracking";
import {
  createNormalizedDesktopAppId,
  normalizeDesktopProcessName,
} from "./hourlyRateSettingsSchemas";

export const nonnegativeSafeIntegerSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

export const trackedAppUsageWireSchema = z
  .object({
    processName: z.string(),
    durationMilliseconds: nonnegativeSafeIntegerSchema,
  })
  .strict();

export const appUsageSnapshotWireSchema = z
  .object({
    schemaVersion: z.literal(APP_USAGE_SNAPSHOT_SCHEMA_VERSION),
    sessionId: z.string().refine((value) => value.trim().length > 0, {
      message: "sessionId must not be empty",
    }),
    startedAt: nonnegativeSafeIntegerSchema,
    capturedAt: nonnegativeSafeIntegerSchema,
    durationMilliseconds: nonnegativeSafeIntegerSchema,
    trackedDurationMilliseconds: nonnegativeSafeIntegerSchema,
    untrackedDurationMilliseconds: nonnegativeSafeIntegerSchema,
    apps: z.array(trackedAppUsageWireSchema),
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (snapshot.capturedAt < snapshot.startedAt) {
      context.addIssue({
        code: "custom",
        message: "capturedAt must not be earlier than startedAt",
        path: ["capturedAt"],
      });
      return;
    }

    if (
      snapshot.durationMilliseconds !==
      snapshot.capturedAt - snapshot.startedAt
    ) {
      context.addIssue({
        code: "custom",
        message: "durationMilliseconds must match the capture boundary",
        path: ["durationMilliseconds"],
      });
    }

    let appDurationSum = 0;
    for (const [index, app] of snapshot.apps.entries()) {
      appDurationSum += app.durationMilliseconds;
      if (!Number.isSafeInteger(appDurationSum)) {
        context.addIssue({
          code: "custom",
          message: "app duration sum must be a safe integer",
          path: ["apps", index, "durationMilliseconds"],
        });
        return;
      }
    }
    if (appDurationSum !== snapshot.trackedDurationMilliseconds) {
      context.addIssue({
        code: "custom",
        message: "trackedDurationMilliseconds must equal the app duration sum",
        path: ["trackedDurationMilliseconds"],
      });
    }

    if (
      snapshot.trackedDurationMilliseconds +
        snapshot.untrackedDurationMilliseconds !==
      snapshot.durationMilliseconds
    ) {
      context.addIssue({
        code: "custom",
        message: "tracked and untracked duration must cover the session",
        path: ["untrackedDurationMilliseconds"],
      });
    }
  });

export type AppUsageSnapshotWire = z.infer<
  typeof appUsageSnapshotWireSchema
>;

export const trackedAppUsageSchema = z
  .object({
    appId: z.string(),
    processName: z.string(),
    durationSeconds: nonnegativeSafeIntegerSchema.positive(),
  })
  .strict()
  .superRefine((app, context) => {
    let normalizedProcessName: string;
    try {
      normalizedProcessName = normalizeDesktopProcessName(app.processName);
    } catch {
      context.addIssue({
        code: "custom",
        message: "processName is invalid",
        path: ["processName"],
      });
      return;
    }

    if (app.processName !== normalizedProcessName) {
      context.addIssue({
        code: "custom",
        message: "processName must be trimmed and NFC-normalized",
        path: ["processName"],
      });
    }
    if (app.appId !== createNormalizedDesktopAppId(normalizedProcessName)) {
      context.addIssue({
        code: "custom",
        message: "appId must match the normalized processName",
        path: ["appId"],
      });
    }
  });

export const appUsageSnapshotSchema = z
  .object({
    schemaVersion: z.literal(APP_USAGE_SNAPSHOT_SCHEMA_VERSION),
    sessionId: z.string().refine((value) => value.trim().length > 0, {
      message: "sessionId must not be empty",
    }),
    startedAt: nonnegativeSafeIntegerSchema,
    capturedAt: nonnegativeSafeIntegerSchema,
    durationSeconds: nonnegativeSafeIntegerSchema,
    trackedDurationSeconds: nonnegativeSafeIntegerSchema,
    untrackedDurationSeconds: nonnegativeSafeIntegerSchema,
    apps: z.array(trackedAppUsageSchema),
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (snapshot.capturedAt < snapshot.startedAt) {
      context.addIssue({
        code: "custom",
        message: "capturedAt must not be earlier than startedAt",
        path: ["capturedAt"],
      });
      return;
    }
    if (
      snapshot.durationSeconds !==
      Math.floor((snapshot.capturedAt - snapshot.startedAt) / 1_000)
    ) {
      context.addIssue({
        code: "custom",
        message: "durationSeconds must match the capture boundary",
        path: ["durationSeconds"],
      });
    }

    const seenAppIds = new Set<string>();
    let trackedDurationSeconds = 0;
    snapshot.apps.forEach((app, index) => {
      if (seenAppIds.has(app.appId)) {
        context.addIssue({
          code: "custom",
          message: "app IDs must be unique",
          path: ["apps", index, "appId"],
        });
      }
      seenAppIds.add(app.appId);

      trackedDurationSeconds += app.durationSeconds;
      if (!Number.isSafeInteger(trackedDurationSeconds)) {
        context.addIssue({
          code: "custom",
          message: "tracked duration must be a safe integer",
          path: ["apps", index, "durationSeconds"],
        });
      }

      if (index > 0) {
        const previous = snapshot.apps[index - 1];
        if (
          previous !== undefined &&
          (previous.durationSeconds < app.durationSeconds ||
            (previous.durationSeconds === app.durationSeconds &&
              previous.appId > app.appId))
        ) {
          context.addIssue({
            code: "custom",
            message: "apps must use deterministic duration/appId order",
            path: ["apps", index],
          });
        }
      }
    });

    if (trackedDurationSeconds !== snapshot.trackedDurationSeconds) {
      context.addIssue({
        code: "custom",
        message: "trackedDurationSeconds must equal the app duration sum",
        path: ["trackedDurationSeconds"],
      });
    }
    if (
      snapshot.trackedDurationSeconds + snapshot.untrackedDurationSeconds !==
      snapshot.durationSeconds
    ) {
      context.addIssue({
        code: "custom",
        message: "tracked and untracked duration must cover the session",
        path: ["untrackedDurationSeconds"],
      });
    }
  }) satisfies z.ZodType<AppUsageSnapshot>;
