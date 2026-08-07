import type { HourlyRateSettings } from "../types/hourlyRateSettings";
import { createDefaultHourlyRateSettings } from "../services/hourlyRateSettingsService";
import { hourlyRateSettingsSchema } from "../utils/hourlyRateSettingsSchemas";
import {
  getSettingsStore,
  type SettingsStore,
} from "./settingsStore";

export const HOURLY_RATE_SETTINGS_STORE_KEY = "hourly-rate-settings-v1";

export type HourlyRateSettingsRepositoryErrorCode =
  | "LOAD_FAILED"
  | "INVALID_STORED_SETTINGS"
  | "INVALID_SETTINGS"
  | "SAVE_FAILED"
  | "RECOVERY_FAILED";

export class HourlyRateSettingsRepositoryError extends Error {
  constructor(
    public readonly code: HourlyRateSettingsRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "HourlyRateSettingsRepositoryError";
  }
}

export interface HourlyRateSettingsRepository {
  load(): Promise<HourlyRateSettings>;
  save(settings: HourlyRateSettings): Promise<HourlyRateSettings>;
}

type SettingsStoreProvider = () => Promise<SettingsStore>;

function compareAppIds(
  left: { appId: string },
  right: { appId: string },
): number {
  if (left.appId < right.appId) {
    return -1;
  }
  if (left.appId > right.appId) {
    return 1;
  }
  return 0;
}

function freezeCanonicalSettings(value: unknown): HourlyRateSettings {
  const parsedSettings = hourlyRateSettingsSchema.parse(value);
  const desktopApps = Object.freeze(
    parsedSettings.desktopApps
      .map((entry) => Object.freeze({ ...entry }))
      .sort(compareAppIds),
  );

  return Object.freeze({
    schemaVersion: parsedSettings.schemaVersion,
    defaultHourlyRateYen: parsedSettings.defaultHourlyRateYen,
    desktopApps,
  });
}

function createRepositoryError(
  code: HourlyRateSettingsRepositoryErrorCode,
): HourlyRateSettingsRepositoryError {
  const messages: Record<HourlyRateSettingsRepositoryErrorCode, string> = {
    LOAD_FAILED: "Hourly rate settings could not be loaded",
    INVALID_STORED_SETTINGS: "Stored hourly rate settings are invalid",
    INVALID_SETTINGS: "Hourly rate settings are invalid",
    SAVE_FAILED: "Hourly rate settings could not be saved",
    RECOVERY_FAILED:
      "Hourly rate settings could not be recovered after a failed save",
  };

  return new HourlyRateSettingsRepositoryError(code, messages[code]);
}

class StoreHourlyRateSettingsRepository
  implements HourlyRateSettingsRepository
{
  private saveQueue: Promise<void> = Promise.resolve();
  private recoveryRequired = false;

  constructor(private readonly provideStore: SettingsStoreProvider) {}

  private async getStore(
    operation: "load" | "save",
  ): Promise<SettingsStore> {
    try {
      return await this.provideStore();
    } catch {
      throw createRepositoryError(
        operation === "load" ? "LOAD_FAILED" : "SAVE_FAILED",
      );
    }
  }

  private async recoverIfRequired(store: SettingsStore): Promise<void> {
    if (!this.recoveryRequired) {
      return;
    }

    try {
      await store.reload({ ignoreDefaults: true });
      this.recoveryRequired = false;
    } catch {
      throw createRepositoryError("RECOVERY_FAILED");
    }
  }

  async load(): Promise<HourlyRateSettings> {
    await this.saveQueue;
    const store = await this.getStore("load");
    await this.recoverIfRequired(store);

    let storedValue: unknown;
    try {
      storedValue = await store.get<unknown>(HOURLY_RATE_SETTINGS_STORE_KEY);
    } catch {
      throw createRepositoryError("LOAD_FAILED");
    }

    if (storedValue === undefined) {
      return createDefaultHourlyRateSettings();
    }

    try {
      return freezeCanonicalSettings(storedValue);
    } catch {
      throw createRepositoryError("INVALID_STORED_SETTINGS");
    }
  }

  save(settings: HourlyRateSettings): Promise<HourlyRateSettings> {
    let canonicalSettings: HourlyRateSettings;
    try {
      canonicalSettings = freezeCanonicalSettings(settings);
    } catch {
      return Promise.reject(createRepositoryError("INVALID_SETTINGS"));
    }

    const saveOperation = this.saveQueue.then(async () => {
      const store = await this.getStore("save");
      await this.recoverIfRequired(store);

      try {
        await store.set(HOURLY_RATE_SETTINGS_STORE_KEY, canonicalSettings);
        await store.save();
      } catch {
        try {
          await store.reload({ ignoreDefaults: true });
          this.recoveryRequired = false;
        } catch {
          this.recoveryRequired = true;
          throw createRepositoryError("RECOVERY_FAILED");
        }
        throw createRepositoryError("SAVE_FAILED");
      }

      return canonicalSettings;
    });

    this.saveQueue = saveOperation.then(
      () => undefined,
      () => undefined,
    );
    return saveOperation;
  }
}

export function createHourlyRateSettingsRepository(
  provideStore: SettingsStoreProvider = getSettingsStore,
): HourlyRateSettingsRepository {
  return new StoreHourlyRateSettingsRepository(provideStore);
}

export const hourlyRateSettingsRepository =
  createHourlyRateSettingsRepository();
