import {
  HOURLY_RATE_SETTINGS_SCHEMA_VERSION,
  type DesktopAppHourlyRateSetting,
  type HourlyRateSettings,
} from "../types/hourlyRateSettings";
import {
  createNormalizedDesktopAppId,
  hourlyRateSettingsSchema,
  hourlyRateYenSchema,
  normalizeDesktopProcessName,
} from "../utils/hourlyRateSettingsSchemas";

export const INITIAL_DEFAULT_HOURLY_RATE_YEN = 0;

function freezeSettings(settings: HourlyRateSettings): HourlyRateSettings {
  const desktopApps = Object.freeze(
    settings.desktopApps.map((entry) => Object.freeze({ ...entry })),
  );

  return Object.freeze({
    schemaVersion: HOURLY_RATE_SETTINGS_SCHEMA_VERSION,
    defaultHourlyRateYen: settings.defaultHourlyRateYen,
    desktopApps,
  });
}

function parseSettings(settings: HourlyRateSettings): HourlyRateSettings {
  return hourlyRateSettingsSchema.parse(settings);
}

function updateDesktopApp(
  processName: string,
  settings: HourlyRateSettings,
  update: (entry: DesktopAppHourlyRateSetting) => DesktopAppHourlyRateSetting,
): HourlyRateSettings {
  const appId = normalizeDesktopAppId(processName);
  const parsedSettings = parseSettings(settings);
  let appFound = false;

  const desktopApps = parsedSettings.desktopApps.map((entry) => {
    if (entry.appId !== appId) {
      return entry;
    }

    appFound = true;
    return update(entry);
  });

  if (!appFound) {
    throw new Error("desktop app is not registered");
  }

  return freezeSettings({ ...parsedSettings, desktopApps });
}

export function normalizeDesktopAppId(processName: string): string {
  return createNormalizedDesktopAppId(processName);
}

export function createDefaultHourlyRateSettings(): HourlyRateSettings {
  return freezeSettings({
    schemaVersion: HOURLY_RATE_SETTINGS_SCHEMA_VERSION,
    defaultHourlyRateYen: INITIAL_DEFAULT_HOURLY_RATE_YEN,
    desktopApps: [],
  });
}

export function registerDesktopApp(
  processName: string,
  settings: HourlyRateSettings,
): HourlyRateSettings {
  const normalizedProcessName = normalizeDesktopProcessName(processName);
  const appId = normalizeDesktopAppId(normalizedProcessName);
  const parsedSettings = parseSettings(settings);

  if (parsedSettings.desktopApps.some((entry) => entry.appId === appId)) {
    return freezeSettings(parsedSettings);
  }

  return freezeSettings({
    ...parsedSettings,
    desktopApps: [
      ...parsedSettings.desktopApps,
      { appId, processName: normalizedProcessName, hourlyRateYen: null },
    ],
  });
}

export function setDefaultHourlyRateYen(
  hourlyRateYen: number,
  settings: HourlyRateSettings,
): HourlyRateSettings {
  const parsedHourlyRateYen = hourlyRateYenSchema.parse(hourlyRateYen);
  const parsedSettings = parseSettings(settings);

  return freezeSettings({
    ...parsedSettings,
    defaultHourlyRateYen: parsedHourlyRateYen,
  });
}

export function setAppHourlyRateYen(
  processName: string,
  hourlyRateYen: number,
  settings: HourlyRateSettings,
): HourlyRateSettings {
  const parsedHourlyRateYen = hourlyRateYenSchema.parse(hourlyRateYen);

  return updateDesktopApp(processName, settings, (entry) => ({
    ...entry,
    hourlyRateYen: parsedHourlyRateYen,
  }));
}

export function clearAppHourlyRateYen(
  processName: string,
  settings: HourlyRateSettings,
): HourlyRateSettings {
  return updateDesktopApp(processName, settings, (entry) => ({
    ...entry,
    hourlyRateYen: null,
  }));
}

export function resolveHourlyRateYen(
  processName: string,
  settings: HourlyRateSettings,
): number {
  const appId = normalizeDesktopAppId(processName);
  const parsedSettings = parseSettings(settings);
  const entry = parsedSettings.desktopApps.find(
    (desktopApp) => desktopApp.appId === appId,
  );

  return entry?.hourlyRateYen ?? parsedSettings.defaultHourlyRateYen;
}
