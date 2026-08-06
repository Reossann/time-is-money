import { z } from "zod";

export const activityCategorySchema = z.enum([
  "productive",
  "waste",
  "neutral",
]);

export const activityRecordSchema = z.object({
  id: z.string(),
  processName: z.string(),
  windowTitle: z.string(),
  category: activityCategorySchema,
  startedAt: z.number(),
  endedAt: z.number().nullable(),
  durationSeconds: z.number(),
  hourlyRate: z.number(),
  calculatedCost: z.number(),
});

export const appRuleSchema = z.object({
  id: z.string(),
  matchType: z.enum(["process", "title", "domain"]),
  matchValue: z.string(),
  category: activityCategorySchema,
});

export const appSettingsSchema = z.object({
  hourlyRate: z.number(),
  notificationThresholdMinutes: z.number(),
  idleThresholdMinutes: z.number(),
  notificationsEnabled: z.boolean(),
});

export const activeWindowInfoSchema = z.object({
  processName: z.string().min(1),
  windowTitle: z.string(),
  processId: z.number().int().positive().max(0xffff_ffff),
});

export const nativeWebAppChangeSchema = z.object({
  url: z.string().url(),
  timestamp: z.number().int().nonnegative(),
});
