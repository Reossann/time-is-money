import { z } from "zod";

import {
  SESSION_RESULT_SCHEMA_VERSION,
  type SessionAppResult,
  type SessionResult,
} from "../types/sessionResult";
import { createNormalizedDesktopAppId, normalizeDesktopProcessName } from "./hourlyRateSettingsSchemas";
import { nonnegativeSafeIntegerSchema } from "./appUsageTrackingSchemas";

const activityCategorySchema = z.enum(["productive", "waste", "neutral"]);

export const moneyBreakdownSchema = z
  .object({
    earnedYen: nonnegativeSafeIntegerSchema,
    wastedYen: nonnegativeSafeIntegerSchema,
    netYen: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
  })
  .strict()
  .superRefine((money, context) => {
    if (money.netYen !== money.earnedYen - money.wastedYen) {
      context.addIssue({
        code: "custom",
        message: "netYen must equal earnedYen minus wastedYen",
        path: ["netYen"],
      });
    }
  });

export const sessionAppResultSchema = z
  .object({
    appId: z.string(),
    processName: z.string(),
    durationSeconds: nonnegativeSafeIntegerSchema.positive(),
    category: activityCategorySchema.nullable(),
    hourlyRateYen: z.number().finite().nonnegative(),
    money: moneyBreakdownSchema,
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
  }) satisfies z.ZodType<SessionAppResult>;

export const sessionResultSchema = z
  .object({
    schemaVersion: z.literal(SESSION_RESULT_SCHEMA_VERSION),
    sessionId: z.string().refine((value) => value.trim().length > 0, {
      message: "sessionId must not be empty",
    }),
    startedAt: nonnegativeSafeIntegerSchema,
    endedAt: nonnegativeSafeIntegerSchema,
    durationSeconds: nonnegativeSafeIntegerSchema,
    trackedDurationSeconds: nonnegativeSafeIntegerSchema,
    untrackedDurationSeconds: nonnegativeSafeIntegerSchema,
    apps: z.array(sessionAppResultSchema),
    totals: moneyBreakdownSchema,
  })
  .strict()
  .superRefine((result, context) => {
    if (result.endedAt < result.startedAt) {
      context.addIssue({
        code: "custom",
        message: "endedAt must not be earlier than startedAt",
        path: ["endedAt"],
      });
    }
    if (
      result.durationSeconds !==
      Math.floor((result.endedAt - result.startedAt) / 1_000)
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

    result.apps.forEach((app, index) => {
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
        const previous = result.apps[index - 1];
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

    if (trackedDurationSeconds !== result.trackedDurationSeconds) {
      context.addIssue({
        code: "custom",
        message: "trackedDurationSeconds must equal the app duration sum",
        path: ["trackedDurationSeconds"],
      });
    }
    if (
      result.trackedDurationSeconds + result.untrackedDurationSeconds !==
      result.durationSeconds
    ) {
      context.addIssue({
        code: "custom",
        message: "tracked and untracked duration must cover the session",
        path: ["untrackedDurationSeconds"],
      });
    }
    if (
      earnedYen !== result.totals.earnedYen ||
      wastedYen !== result.totals.wastedYen ||
      earnedYen - wastedYen !== result.totals.netYen
    ) {
      context.addIssue({
        code: "custom",
        message: "totals must equal the app money sum",
        path: ["totals"],
      });
    }
  }) satisfies z.ZodType<SessionResult>;
