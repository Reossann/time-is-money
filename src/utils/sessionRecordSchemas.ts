import { z } from "zod";

import {
  SESSION_RECORD_SCHEMA_VERSION,
  type SessionRecord,
} from "../types/sessionRecord";
import { nonnegativeSafeIntegerSchema } from "./appUsageTrackingSchemas";
import { toLocalDateKey } from "./localDate";
import {
  moneyBreakdownSchema,
  sessionAppResultSchema,
} from "./sessionResultSchemas";

const syncStatusSchema = z.enum(["local-only", "pending-sync", "synced"]);

const localDateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "localDateKey must be a YYYY-MM-DD string");

export const sessionRecordSchema = z
  .object({
    schemaVersion: z.literal(SESSION_RECORD_SCHEMA_VERSION),
    sessionId: z.string().refine((value) => value.trim().length > 0, {
      message: "sessionId must not be empty",
    }),
    ownerId: z.string().refine((value) => value.trim().length > 0, {
      message: "ownerId must not be empty",
    }),
    startedAt: nonnegativeSafeIntegerSchema,
    endedAt: nonnegativeSafeIntegerSchema,
    durationSeconds: nonnegativeSafeIntegerSchema,
    trackedDurationSeconds: nonnegativeSafeIntegerSchema,
    untrackedDurationSeconds: nonnegativeSafeIntegerSchema,
    apps: z.array(sessionAppResultSchema),
    totals: moneyBreakdownSchema,
    localDateKey: localDateKeySchema,
    createdAt: nonnegativeSafeIntegerSchema,
    updatedAt: nonnegativeSafeIntegerSchema,
    syncStatus: syncStatusSchema,
  })
  .strict()
  .superRefine((record, context) => {
    // Session invariants must mirror sessionResultSchema so a persisted record
    // stays consistent with the finalized result it was built from.
    if (record.endedAt < record.startedAt) {
      context.addIssue({
        code: "custom",
        message: "endedAt must not be earlier than startedAt",
        path: ["endedAt"],
      });
    }
    if (
      record.durationSeconds !==
      Math.floor((record.endedAt - record.startedAt) / 1_000)
    ) {
      context.addIssue({
        code: "custom",
        message: "durationSeconds must match the stop boundary",
        path: ["durationSeconds"],
      });
    }

    const seenAppIds = new Set<string>();
    let trackedDurationSeconds = 0;
    let earnedYen = 0;
    let wastedYen = 0;

    record.apps.forEach((app, index) => {
      if (seenAppIds.has(app.appId)) {
        context.addIssue({
          code: "custom",
          message: "app IDs must be unique",
          path: ["apps", index, "appId"],
        });
      }
      seenAppIds.add(app.appId);

      trackedDurationSeconds += app.durationSeconds;
      earnedYen += app.money.earnedYen;
      wastedYen += app.money.wastedYen;
      if (
        !Number.isSafeInteger(trackedDurationSeconds) ||
        !Number.isSafeInteger(earnedYen) ||
        !Number.isSafeInteger(wastedYen)
      ) {
        context.addIssue({
          code: "custom",
          message: "app totals must remain safe integers",
          path: ["apps", index],
        });
      }

      if (index > 0) {
        const previous = record.apps[index - 1];
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

    if (trackedDurationSeconds !== record.trackedDurationSeconds) {
      context.addIssue({
        code: "custom",
        message: "trackedDurationSeconds must equal the app duration sum",
        path: ["trackedDurationSeconds"],
      });
    }
    if (
      record.trackedDurationSeconds + record.untrackedDurationSeconds !==
      record.durationSeconds
    ) {
      context.addIssue({
        code: "custom",
        message: "tracked and untracked duration must cover the session",
        path: ["untrackedDurationSeconds"],
      });
    }
    if (
      earnedYen !== record.totals.earnedYen ||
      wastedYen !== record.totals.wastedYen ||
      earnedYen - wastedYen !== record.totals.netYen
    ) {
      context.addIssue({
        code: "custom",
        message: "totals must equal the app money sum",
        path: ["totals"],
      });
    }

    // Record-specific invariants.
    let expectedDateKey: string | null = null;
    try {
      expectedDateKey = toLocalDateKey(record.endedAt);
    } catch {
      context.addIssue({
        code: "custom",
        message: "endedAt cannot derive a local date key",
        path: ["endedAt"],
      });
    }
    if (expectedDateKey !== null && record.localDateKey !== expectedDateKey) {
      context.addIssue({
        code: "custom",
        message: "localDateKey must match endedAt in local time",
        path: ["localDateKey"],
      });
    }
    if (record.updatedAt < record.createdAt) {
      context.addIssue({
        code: "custom",
        message: "updatedAt must not be earlier than createdAt",
        path: ["updatedAt"],
      });
    }
  }) satisfies z.ZodType<SessionRecord>;
