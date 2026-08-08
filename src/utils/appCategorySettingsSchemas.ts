import { z } from "zod";

import {
  APP_CATEGORY_SETTINGS_SCHEMA_VERSION,
  type AppCategorySettings,
} from "../types/appCategorySettings";
import {
  createNormalizedDesktopAppId,
  normalizeDesktopProcessName,
} from "./hourlyRateSettingsSchemas";

export const activityCategorySchema = z.enum([
  "productive",
  "waste",
  "neutral",
]);

export const appCategorySettingSchema = z
  .object({
    appId: z.string(),
    processName: z.string(),
    category: activityCategorySchema,
  })
  .strict()
  .superRefine((entry, context) => {
    let normalizedProcessName: string;

    try {
      normalizedProcessName = normalizeDesktopProcessName(entry.processName);
    } catch {
      context.addIssue({
        code: "custom",
        message: "processName is invalid",
        path: ["processName"],
      });
      return;
    }

    if (entry.processName !== normalizedProcessName) {
      context.addIssue({
        code: "custom",
        message: "processName must be trimmed and NFC-normalized",
        path: ["processName"],
      });
    }

    if (entry.appId !== createNormalizedDesktopAppId(normalizedProcessName)) {
      context.addIssue({
        code: "custom",
        message: "appId must match the normalized processName",
        path: ["appId"],
      });
    }
  });

export const appCategorySettingsSchema = z
  .object({
    schemaVersion: z.literal(APP_CATEGORY_SETTINGS_SCHEMA_VERSION),
    desktopApps: z.array(appCategorySettingSchema),
  })
  .strict()
  .superRefine((settings, context) => {
    const seenAppIds = new Set<string>();

    settings.desktopApps.forEach((entry, index) => {
      if (seenAppIds.has(entry.appId)) {
        context.addIssue({
          code: "custom",
          message: "desktop app IDs must be unique",
          path: ["desktopApps", index, "appId"],
        });
      }
      seenAppIds.add(entry.appId);
    });
  }) satisfies z.ZodType<AppCategorySettings>;
