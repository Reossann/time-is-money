import type { AppCategorySettings } from "../types/appCategorySettings";
import { createDefaultAppCategorySettings } from "../services/appCategorySettingsService";
import { appCategorySettingsSchema } from "../utils/appCategorySettingsSchemas";
import { getSettingsStore, type SettingsStore } from "./settingsStore";

export const APP_CATEGORY_SETTINGS_STORE_KEY = "app-category-settings-v1";

export type AppCategorySettingsRepositoryErrorCode =
  | "LOAD_FAILED"
  | "INVALID_STORED_SETTINGS"
  | "INVALID_SETTINGS"
  | "SAVE_FAILED";

export class AppCategorySettingsRepositoryError extends Error {
  constructor(
    public readonly code: AppCategorySettingsRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppCategorySettingsRepositoryError";
  }
}

export interface AppCategorySettingsRepository {
  load(): Promise<AppCategorySettings>;
  save(settings: AppCategorySettings): Promise<AppCategorySettings>;
}

type SettingsStoreProvider = () => Promise<SettingsStore>;

function createRepositoryError(
  code: AppCategorySettingsRepositoryErrorCode,
): AppCategorySettingsRepositoryError {
  const messages: Record<AppCategorySettingsRepositoryErrorCode, string> = {
    LOAD_FAILED: "App category settings could not be loaded",
    INVALID_STORED_SETTINGS: "Stored app category settings are invalid",
    INVALID_SETTINGS: "App category settings are invalid",
    SAVE_FAILED: "App category settings could not be saved",
  };
  return new AppCategorySettingsRepositoryError(code, messages[code]);
}

function freezeCanonicalSettings(value: unknown): AppCategorySettings {
  const parsed = appCategorySettingsSchema.parse(value);
  return Object.freeze({
    schemaVersion: parsed.schemaVersion,
    desktopApps: Object.freeze(
      parsed.desktopApps
        .map((entry) => Object.freeze({ ...entry }))
        .sort((left, right) => left.appId.localeCompare(right.appId)),
    ),
  });
}

class StoreAppCategorySettingsRepository implements AppCategorySettingsRepository {
  private saveQueue: Promise<void> = Promise.resolve();

  constructor(private readonly provideStore: SettingsStoreProvider) {}

  async load(): Promise<AppCategorySettings> {
    await this.saveQueue;
    let store: SettingsStore;
    let storedValue: unknown;

    try {
      store = await this.provideStore();
      storedValue = await store.get<unknown>(APP_CATEGORY_SETTINGS_STORE_KEY);
    } catch {
      throw createRepositoryError("LOAD_FAILED");
    }

    if (storedValue === undefined) return createDefaultAppCategorySettings();

    try {
      return freezeCanonicalSettings(storedValue);
    } catch {
      throw createRepositoryError("INVALID_STORED_SETTINGS");
    }
  }

  save(settings: AppCategorySettings): Promise<AppCategorySettings> {
    let canonicalSettings: AppCategorySettings;
    try {
      canonicalSettings = freezeCanonicalSettings(settings);
    } catch {
      return Promise.reject(createRepositoryError("INVALID_SETTINGS"));
    }

    const operation = this.saveQueue.then(async () => {
      try {
        const store = await this.provideStore();
        await store.set(APP_CATEGORY_SETTINGS_STORE_KEY, canonicalSettings);
        await store.save();
      } catch {
        throw createRepositoryError("SAVE_FAILED");
      }
      return canonicalSettings;
    });
    this.saveQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }
}

export function createAppCategorySettingsRepository(
  provideStore: SettingsStoreProvider = getSettingsStore,
): AppCategorySettingsRepository {
  return new StoreAppCategorySettingsRepository(provideStore);
}

export const appCategorySettingsRepository = createAppCategorySettingsRepository();
