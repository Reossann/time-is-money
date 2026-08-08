import { z } from "zod";

const nonnegativeSafeIntegerSchema = z.number().int().nonnegative().safe();

export const graphPeriodSchema = z.enum(["day", "week", "month"]);

export const graphMetricSchema = z.enum([
  "usageSeconds",
  "earnedYen",
  "wastedYen",
  "netYen",
]);

export const graphPointSchema = z
  .object({
    dateKey: z.string().min(1),
    label: z.string().min(1),
    usageSeconds: nonnegativeSafeIntegerSchema,
    earnedYen: nonnegativeSafeIntegerSchema,
    wastedYen: nonnegativeSafeIntegerSchema,
    netYen: z.number().int().safe(),
  })
  .strict()
  .refine((point) => point.netYen === point.earnedYen - point.wastedYen, {
    message: "netYen must equal earnedYen - wastedYen",
    path: ["netYen"],
  });

export const graphDataSchema = z
  .object({
    period: graphPeriodSchema,
    metric: graphMetricSchema,
    points: z.array(graphPointSchema),
  })
  .strict();
