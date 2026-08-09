import type { AppUsageLimitSettings } from "../types/appUsageLimitSettings";
import { createDefaultAppUsageLimitSettings } from "../services/appUsageLimitSettingsService";
import { appUsageLimitSettingsSchema } from "../utils/appUsageLimitSettingsSchemas";
import { getSettingsStore, type SettingsStore } from "./settingsStore";

export const APP_USAGE_LIMIT_SETTINGS_STORE_KEY = "app-usage-limit-settings-v1";
export interface AppUsageLimitSettingsRepository { load(): Promise<AppUsageLimitSettings>; save(settings: AppUsageLimitSettings): Promise<AppUsageLimitSettings>; }

export function createAppUsageLimitSettingsRepository(provideStore: () => Promise<SettingsStore> = getSettingsStore): AppUsageLimitSettingsRepository {
  let saveQueue = Promise.resolve();
  const canonicalize = (value: unknown) => {
    const parsed = appUsageLimitSettingsSchema.parse(value);
    return Object.freeze({ schemaVersion: parsed.schemaVersion, desktopApps: Object.freeze(parsed.desktopApps.map((entry) => Object.freeze({ ...entry })).sort((a, b) => a.appId.localeCompare(b.appId))) });
  };
  return {
    async load() {
      await saveQueue;
      const value = await (await provideStore()).get<unknown>(APP_USAGE_LIMIT_SETTINGS_STORE_KEY);
      return value === undefined ? createDefaultAppUsageLimitSettings() : canonicalize(value);
    },
    save(settings) {
      const canonical = canonicalize(settings);
      const operation = saveQueue.then(async () => { const store = await provideStore(); await store.set(APP_USAGE_LIMIT_SETTINGS_STORE_KEY, canonical); await store.save(); return canonical; });
      saveQueue = operation.then(() => undefined, () => undefined);
      return operation;
    },
  };
}

export const appUsageLimitSettingsRepository = createAppUsageLimitSettingsRepository();
