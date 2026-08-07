import { z } from "zod";

import {
  HOURLY_RATE_SETTINGS_SCHEMA_VERSION,
  type HourlyRateSettings,
} from "../types/hourlyRateSettings";

const PATH_SEPARATOR_PATTERN = /[\\/]/u;

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return (
      codePoint !== undefined &&
      (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f))
    );
  });
}

const desktopProcessNameInputSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: "processName must not be empty",
  })
  .refine((value) => !containsControlCharacter(value), {
    message: "processName must not contain control characters",
  })
  .refine((value) => !PATH_SEPARATOR_PATTERN.test(value), {
    message: "processName must be a basename without path separators",
  });

export function normalizeDesktopProcessName(processName: string): string {
  return desktopProcessNameInputSchema.parse(processName).trim().normalize("NFC");
}

export function createNormalizedDesktopAppId(processName: string): string {
  return normalizeDesktopProcessName(processName).toLowerCase();
}

export const hourlyRateYenSchema = z
  .number()
  .refine(Number.isFinite, { message: "hourly rate must be finite" })
  .nonnegative();

export const desktopAppHourlyRateSettingSchema = z
  .object({
    appId: z.string(),
    processName: z.string(),
    hourlyRateYen: hourlyRateYenSchema.nullable(),
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

    if (entry.appId !== normalizedProcessName.toLowerCase()) {
      context.addIssue({
        code: "custom",
        message: "appId must match the normalized processName",
        path: ["appId"],
      });
    }
  });

export const hourlyRateSettingsSchema = z
  .object({
    schemaVersion: z.literal(HOURLY_RATE_SETTINGS_SCHEMA_VERSION),
    defaultHourlyRateYen: hourlyRateYenSchema,
    desktopApps: z.array(desktopAppHourlyRateSettingSchema),
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
  }) satisfies z.ZodType<HourlyRateSettings>;
