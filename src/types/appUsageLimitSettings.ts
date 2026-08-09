export const APP_USAGE_LIMIT_SETTINGS_SCHEMA_VERSION = 1 as const;

export type AppUsageLimitSetting = Readonly<{
  appId: string;
  processName: string;
  dailyLimitSeconds: number;
  continuousLimitSeconds: number;
  cooldownSeconds: number;
  enabled: boolean;
}>;

export type AppUsageLimitSettings = Readonly<{
  schemaVersion: typeof APP_USAGE_LIMIT_SETTINGS_SCHEMA_VERSION;
  desktopApps: ReadonlyArray<AppUsageLimitSetting>;
}>;
