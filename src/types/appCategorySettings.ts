import type { ActivityCategory } from "./activity";

export const APP_CATEGORY_SETTINGS_SCHEMA_VERSION = 1 as const;

export type AppCategorySetting = Readonly<{
  appId: string;
  processName: string;
  category: ActivityCategory;
}>;

export type AppCategorySettings = Readonly<{
  schemaVersion: typeof APP_CATEGORY_SETTINGS_SCHEMA_VERSION;
  desktopApps: ReadonlyArray<AppCategorySetting>;
}>;
