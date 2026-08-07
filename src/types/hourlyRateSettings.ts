export const HOURLY_RATE_SETTINGS_SCHEMA_VERSION = 1 as const;

export type DesktopAppHourlyRateSetting = Readonly<{
  appId: string;
  processName: string;
  hourlyRateYen: number | null;
}>;

export type HourlyRateSettings = Readonly<{
  schemaVersion: typeof HOURLY_RATE_SETTINGS_SCHEMA_VERSION;
  defaultHourlyRateYen: number;
  desktopApps: ReadonlyArray<DesktopAppHourlyRateSetting>;
}>;
