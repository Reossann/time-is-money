import { z } from "zod";

import type {
  AggregationGranularity,
  AggregationQuery,
  LifetimeMoneySummary,
  PeriodAggregate,
} from "../types/aggregation";
import { nonnegativeSafeIntegerSchema } from "./appUsageTrackingSchemas";

const utcIsoTimestampSchema = z
  .string()
  .datetime({ offset: false, precision: 3 })
  .refine((value) => value.endsWith("Z"), {
    message: "timestamp must use UTC Z suffix",
  });

export function isSupportedTimeZone(value: string): boolean {
  if (value.trim().length === 0) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const timeZoneIdSchema = z.string().superRefine((value, context) => {
  if (value.trim().length === 0) {
    context.addIssue({ code: "custom", message: "timeZoneId must not be empty" });
    return;
  }
  if (!isSupportedTimeZone(value)) {
    context.addIssue({ code: "custom", message: "timeZoneId must be supported" });
  }
});

const granularitySchema = z.enum(["day", "week", "month"]);

const periodKeySchemas: Record<AggregationGranularity, z.ZodString> = {
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  week: z.string().regex(/^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/),
  month: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/),
};

export const aggregationQuerySchema = z
  .object({
    ownerId: z.string().trim().min(1),
    granularity: granularitySchema,
    from: utcIsoTimestampSchema,
    to: utcIsoTimestampSchema,
    timeZoneId: timeZoneIdSchema,
    includeEmptyPeriods: z.boolean().optional(),
  })
  .strict()
  .superRefine((query, context) => {
    if (Date.parse(query.from) >= Date.parse(query.to)) {
      context.addIssue({
        code: "custom",
        message: "from must be earlier than to",
        path: ["to"],
      });
    }
  }) satisfies z.ZodType<AggregationQuery>;

export const periodAggregateSchema = z
  .object({
    period: z
      .object({
        granularity: granularitySchema,
        key: z.string(),
        startAt: utcIsoTimestampSchema,
        endAt: utcIsoTimestampSchema,
        timeZoneId: timeZoneIdSchema,
      })
      .strict()
      .superRefine((period, context) => {
        if (!periodKeySchemas[period.granularity].safeParse(period.key).success) {
          context.addIssue({
            code: "custom",
            message: "key must match granularity",
            path: ["key"],
          });
        }
        if (Date.parse(period.startAt) >= Date.parse(period.endAt)) {
          context.addIssue({
            code: "custom",
            message: "startAt must be earlier than endAt",
            path: ["endAt"],
          });
        }
      }),
    sessionCount: nonnegativeSafeIntegerSchema,
    durationSeconds: nonnegativeSafeIntegerSchema,
    trackedDurationSeconds: nonnegativeSafeIntegerSchema,
    untrackedDurationSeconds: nonnegativeSafeIntegerSchema,
    earnedYen: nonnegativeSafeIntegerSchema,
    wastedYen: nonnegativeSafeIntegerSchema,
    netYen: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
  })
  .strict()
  .superRefine((aggregate, context) => {
    if (
      aggregate.trackedDurationSeconds + aggregate.untrackedDurationSeconds !==
      aggregate.durationSeconds
    ) {
      context.addIssue({
        code: "custom",
        message: "tracked and untracked duration must cover the period",
        path: ["untrackedDurationSeconds"],
      });
    }
    if (aggregate.netYen !== aggregate.earnedYen - aggregate.wastedYen) {
      context.addIssue({
        code: "custom",
        message: "netYen must equal earnedYen minus wastedYen",
        path: ["netYen"],
      });
    }
  }) satisfies z.ZodType<PeriodAggregate>;

export const lifetimeMoneySummarySchema = z
  .object({
    ownerId: z.string().trim().min(1),
    sessionCount: nonnegativeSafeIntegerSchema,
    earnedYen: nonnegativeSafeIntegerSchema,
    wastedYen: nonnegativeSafeIntegerSchema,
    netYen: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
  })
  .strict()
  .superRefine((summary, context) => {
    if (summary.netYen !== summary.earnedYen - summary.wastedYen) {
      context.addIssue({
        code: "custom",
        message: "netYen must equal earnedYen minus wastedYen",
        path: ["netYen"],
      });
    }
  }) satisfies z.ZodType<LifetimeMoneySummary>;
