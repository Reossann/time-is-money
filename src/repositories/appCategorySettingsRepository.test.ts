import { describe, expect, it } from "vitest";

import {
  createAppCategorySettingsRepository,
  APP_CATEGORY_SETTINGS_STORE_KEY,
} from "./appCategorySettingsRepository";
import { setAppCategory } from "../services/appCategorySettingsService";
import type { SettingsStore } from "./settingsStore";

function createStore(initial: Record<string, unknown> = {}): SettingsStore & {
  values: Record<string, unknown>;
} {
  const values = { ...initial };
  return {
    values,
    get: async <T>(key: string) => values[key] as T | undefined,
    set: async (key, value) => {
      values[key] = value;
    },
    reload: async () => undefined,
    save: async () => undefined,
  };
}

describe("appCategorySettingsRepository", () => {
  it("returns defaults, persists canonical settings, and loads them", async () => {
    const store = createStore();
    const repository = createAppCategorySettingsRepository(async () => store);
    const settings = setAppCategory("Code.exe", "productive", await repository.load());

    await expect(repository.save(settings)).resolves.toEqual(settings);
    await expect(repository.load()).resolves.toEqual(settings);
    expect(store.values[APP_CATEGORY_SETTINGS_STORE_KEY]).toEqual(settings);
  });

  it("rejects invalid stored data without exposing it", async () => {
    const repository = createAppCategorySettingsRepository(async () =>
      createStore({
        [APP_CATEGORY_SETTINGS_STORE_KEY]: {
          schemaVersion: 1,
          desktopApps: [{ appId: "code.exe", processName: "Code.exe", category: "bad" }],
        },
      }),
    );

    await expect(repository.load()).rejects.toMatchObject({
      code: "INVALID_STORED_SETTINGS",
    });
  });
});
