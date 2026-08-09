import {
  APP_USAGE_LIMIT_SETTINGS_SCHEMA_VERSION,
  type AppUsageLimitSetting,
  type AppUsageLimitSettings,
} from "../types/appUsageLimitSettings";
import { appUsageLimitSettingsSchema } from "../utils/appUsageLimitSettingsSchemas";
import { createNormalizedDesktopAppId, normalizeDesktopProcessName } from "../utils/hourlyRateSettingsSchemas";

function freezeSettings(settings: AppUsageLimitSettings): AppUsageLimitSettings {
  const parsed = appUsageLimitSettingsSchema.parse(settings);
  return Object.freeze({
    schemaVersion: parsed.schemaVersion,
    desktopApps: Object.freeze(parsed.desktopApps.map((entry) => Object.freeze({ ...entry })).sort((a, b) => a.appId.localeCompare(b.appId))),
  });
}

export function createDefaultAppUsageLimitSettings(): AppUsageLimitSettings {
  return freezeSettings({ schemaVersion: APP_USAGE_LIMIT_SETTINGS_SCHEMA_VERSION, desktopApps: [] });
}

export function upsertAppUsageLimit(setting: AppUsageLimitSetting, settings: AppUsageLimitSettings): AppUsageLimitSettings {
  const parsed = appUsageLimitSettingsSchema.parse(settings);
  const normalizedProcessName = normalizeDesktopProcessName(setting.processName);
  const canonical = { ...setting, processName: normalizedProcessName, appId: createNormalizedDesktopAppId(normalizedProcessName) };
  const desktopApps = parsed.desktopApps.some((entry) => entry.appId === canonical.appId)
    ? parsed.desktopApps.map((entry) => (entry.appId === canonical.appId ? canonical : entry))
    : [...parsed.desktopApps, canonical];
  return freezeSettings({ ...parsed, desktopApps });
}

export function replaceAppUsageLimit(
  previousAppId: string,
  setting: AppUsageLimitSetting,
  settings: AppUsageLimitSettings,
): AppUsageLimitSettings {
  const parsed = appUsageLimitSettingsSchema.parse(settings);
  const normalizedProcessName = normalizeDesktopProcessName(setting.processName);
  const canonical = { ...setting, processName: normalizedProcessName, appId: createNormalizedDesktopAppId(normalizedProcessName) };
  const remainingApps = parsed.desktopApps.filter((entry) => entry.appId !== previousAppId);
  if (remainingApps.some((entry) => entry.appId === canonical.appId)) {
    throw new Error("An app usage limit already exists for this process name.");
  }
  return freezeSettings({ ...parsed, desktopApps: [...remainingApps, canonical] });
}

export function removeAppUsageLimit(processName: string, settings: AppUsageLimitSettings): AppUsageLimitSettings {
  const appId = createNormalizedDesktopAppId(processName);
  const parsed = appUsageLimitSettingsSchema.parse(settings);
  return freezeSettings({ ...parsed, desktopApps: parsed.desktopApps.filter((entry) => entry.appId !== appId) });
}
