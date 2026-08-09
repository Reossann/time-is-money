import { z } from "zod";

import {
  APP_USAGE_LIMIT_SETTINGS_SCHEMA_VERSION,
  type AppUsageLimitSettings,
} from "../types/appUsageLimitSettings";
import {
  createNormalizedDesktopAppId,
  normalizeDesktopProcessName,
} from "./hourlyRateSettingsSchemas";

const positiveSeconds = z.number().int().positive();

export const appUsageLimitSettingSchema = z
  .object({
    appId: z.string().min(1),
    processName: z.string(),
    dailyLimitSeconds: positiveSeconds,
    continuousLimitSeconds: positiveSeconds,
    cooldownSeconds: z.number().int().nonnegative(),
    enabled: z.boolean(),
  })
  .strict()
  .superRefine((entry, context) => {
    let normalizedProcessName: string;
    try {
      normalizedProcessName = normalizeDesktopProcessName(entry.processName);
    } catch {
      context.addIssue({ code: "custom", message: "processName is invalid", path: ["processName"] });
      return;
    }
    if (entry.processName !== normalizedProcessName) {
      context.addIssue({ code: "custom", message: "processName must be normalized", path: ["processName"] });
    }
    if (entry.appId !== createNormalizedDesktopAppId(normalizedProcessName)) {
      context.addIssue({ code: "custom", message: "appId must match processName", path: ["appId"] });
    }
  });

export const appUsageLimitSettingsSchema = z
  .object({
    schemaVersion: z.literal(APP_USAGE_LIMIT_SETTINGS_SCHEMA_VERSION),
    desktopApps: z.array(appUsageLimitSettingSchema),
  })
  .strict()
  .superRefine((settings, context) => {
    const seen = new Set<string>();
    settings.desktopApps.forEach((entry, index) => {
      if (seen.has(entry.appId)) {
        context.addIssue({ code: "custom", message: "desktop app IDs must be unique", path: ["desktopApps", index, "appId"] });
      }
      seen.add(entry.appId);
    });
  }) satisfies z.ZodType<AppUsageLimitSettings>;
