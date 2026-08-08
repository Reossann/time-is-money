import type { ActivityCategory } from "../types/activity";
import {
  APP_CATEGORY_SETTINGS_SCHEMA_VERSION,
  type AppCategorySettings,
} from "../types/appCategorySettings";
import {
  activityCategorySchema,
  appCategorySettingsSchema,
} from "../utils/appCategorySettingsSchemas";
import {
  createNormalizedDesktopAppId,
  normalizeDesktopProcessName,
} from "../utils/hourlyRateSettingsSchemas";

function compareAppIds(left: { appId: string }, right: { appId: string }): number {
  return left.appId.localeCompare(right.appId);
}

function freezeSettings(settings: AppCategorySettings): AppCategorySettings {
  const parsed = appCategorySettingsSchema.parse(settings);
  return Object.freeze({
    schemaVersion: parsed.schemaVersion,
    desktopApps: Object.freeze(
      parsed.desktopApps
        .map((entry) => Object.freeze({ ...entry }))
        .sort(compareAppIds),
    ),
  });
}

export function createDefaultAppCategorySettings(): AppCategorySettings {
  return freezeSettings({
    schemaVersion: APP_CATEGORY_SETTINGS_SCHEMA_VERSION,
    desktopApps: [],
  });
}

export function setAppCategory(
  processName: string,
  category: ActivityCategory,
  settings: AppCategorySettings,
): AppCategorySettings {
  const normalizedProcessName = normalizeDesktopProcessName(processName);
  const appId = createNormalizedDesktopAppId(normalizedProcessName);
  const parsedCategory = activityCategorySchema.parse(category);
  const parsedSettings = appCategorySettingsSchema.parse(settings);
  let updated = false;

  const desktopApps = parsedSettings.desktopApps.map((entry) => {
    if (entry.appId !== appId) return entry;

    updated = true;
    return { appId, processName: normalizedProcessName, category: parsedCategory };
  });

  if (!updated) {
    desktopApps.push({
      appId,
      processName: normalizedProcessName,
      category: parsedCategory,
    });
  }

  return freezeSettings({ ...parsedSettings, desktopApps });
}

export function removeAppCategory(
  processName: string,
  settings: AppCategorySettings,
): AppCategorySettings {
  const appId = createNormalizedDesktopAppId(processName);
  const parsedSettings = appCategorySettingsSchema.parse(settings);

  return freezeSettings({
    ...parsedSettings,
    desktopApps: parsedSettings.desktopApps.filter((entry) => entry.appId !== appId),
  });
}

export function createAppCategoryMap(
  settings: AppCategorySettings,
): ReadonlyMap<string, ActivityCategory> {
  const parsedSettings = appCategorySettingsSchema.parse(settings);
  return new Map(
    parsedSettings.desktopApps.map((entry) => [entry.appId, entry.category]),
  );
}
