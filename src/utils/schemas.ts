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

export const notificationToneSchema = z.enum(["sparta", "gentle"]);

export const notificationIntervalMinutesSchema = z.union([
  z.literal(1),
  z.literal(5),
  z.literal(10),
  z.literal(15),
  z.literal(30),
  z.literal(60),
  z.literal(120),
]);

export const appSettingsSchema = z.object({
  hourlyRate: z.number(),
  notificationThresholdMinutes: z.number(),
  idleThresholdMinutes: z.number(),
  notificationsEnabled: z.boolean(),
  notificationTone: notificationToneSchema,
  notificationIntervalMinutes: notificationIntervalMinutesSchema,
});

export const activeWindowInfoSchema = z.object({
  processName: z.string().min(1),
  windowTitle: z.string(),
  processId: z.number().int().positive().max(0xffff_ffff),
});
