import type { AppSettings } from "../types/settings";
import { appSettingsSchema } from "../utils/schemas";
import { getSettingsStore } from "../repositories/settingsStore";

const SETTINGS_KEY = "app-settings";

function normalizeLegacyInterval(value: unknown): unknown {
  return [1, 5, 10].includes(value as number) ? 30 : value;
}

function normalizeStoredSettings(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const settings = value as Record<string, unknown>;
  return {
    ...settings,
    notificationIntervalMinutes: normalizeLegacyInterval(
      settings.notificationIntervalMinutes,
    ),
  };
}

export function createDefaultSettings(): AppSettings {
  return {
    hourlyRate: 3000,
    notificationThresholdMinutes: 30,
    idleThresholdMinutes: 5,
    notificationsEnabled: true,
    notificationTone: "sparta",
    notificationIntervalMinutes: 30,
  };
}

export async function loadSettings(): Promise<AppSettings> {
  const store = await getSettingsStore();

  try {
    const storedSettings = await store.get<unknown>(SETTINGS_KEY);

    if (storedSettings === undefined) {
      return createDefaultSettings();
    }

    const parsedSettings = appSettingsSchema.safeParse(
      normalizeStoredSettings(storedSettings),
    );
    if (!parsedSettings.success) {
      return createDefaultSettings();
    }

    return parsedSettings.data;
  } catch (error) {
    console.error("設定の読み込みに失敗しました", error);
    return createDefaultSettings();
  }
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const parsedSettings = appSettingsSchema.safeParse(settings);
  if (!parsedSettings.success) {
    throw new Error("設定の形式が正しくありません");
  }

  const store = await getSettingsStore();

  try {
    await store.set(SETTINGS_KEY, parsedSettings.data);
    await store.save();
    return parsedSettings.data;
  } catch (error) {
    console.error("設定の保存に失敗しました", error);
    throw error;
  }
}
