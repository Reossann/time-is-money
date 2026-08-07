import { load } from "@tauri-apps/plugin-store";

const SETTINGS_STORE_PATH = "settings.json";

export interface SettingsStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
}

let settingsStorePromise: Promise<SettingsStore> | undefined;

export function getSettingsStore(): Promise<SettingsStore> {
  settingsStorePromise ??= load(SETTINGS_STORE_PATH, { autoSave: false });
  return settingsStorePromise;
}
