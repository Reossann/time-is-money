import type { AppSettings } from "../types/settings";
import { appSettingsSchema } from "../utils/schemas";
import { getSettingsStore } from "../repositories/settingsStore";

const SETTINGS_KEY = "app-settings";

function normalizeSettings(settings: AppSettings): AppSettings {
  const normalizedInterval = [1, 5, 10, 15].includes(settings.notificationIntervalMinutes)
    ? 30
    : settings.notificationIntervalMinutes;

  return {
    ...settings,
    notificationIntervalMinutes: normalizedInterval,
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
    const storedSettings = await store.get<AppSettings>(SETTINGS_KEY);

    if (storedSettings === undefined) {
      return createDefaultSettings();
    }

    const parsedSettings = appSettingsSchema.safeParse(storedSettings);
    if (!parsedSettings.success) {
      return createDefaultSettings();
    }

    return normalizeSettings(parsedSettings.data);
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

  const normalizedSettings = normalizeSettings(parsedSettings.data);
  const store = await getSettingsStore();

  try {
    await store.set(SETTINGS_KEY, normalizedSettings);
    await store.save();
    return normalizedSettings;
  } catch (error) {
    console.error("設定の保存に失敗しました", error);
    throw error;
  }
}
