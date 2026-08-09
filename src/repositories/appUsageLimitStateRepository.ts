import { getSettingsStore } from "./settingsStore";
import type { AppUsageLimitNotificationDeliveryState } from "../services/appUsageLimitCooldownService";
import type { AppUsageLimitState } from "../types/appUsageLimitState";

const STATE_KEY = "app-usage-limit-runtime-v1";
type PersistedState = Pick<AppUsageLimitState, "localDate" | "lastCapturedAt" | "dailySecondsByAppId"> & { deliveryState: AppUsageLimitNotificationDeliveryState };

export async function loadAppUsageLimitRuntime(localDate: string): Promise<{ state: AppUsageLimitState | null; deliveryState: AppUsageLimitNotificationDeliveryState }> {
  const value = await (await getSettingsStore()).get<unknown>(STATE_KEY);
  if (typeof value !== "object" || value === null) return { state: null, deliveryState: {} };
  const candidate = value as Partial<PersistedState>;
  if (candidate.localDate !== localDate || typeof candidate.lastCapturedAt !== "number" || typeof candidate.dailySecondsByAppId !== "object" || candidate.dailySecondsByAppId === null) return { state: null, deliveryState: {} };
  return { state: { localDate, lastCapturedAt: candidate.lastCapturedAt, activeAppId: null, continuousSeconds: 0, dailySecondsByAppId: candidate.dailySecondsByAppId as Record<string, number> }, deliveryState: candidate.deliveryState ?? {} };
}

export async function saveAppUsageLimitRuntime(state: AppUsageLimitState, deliveryState: AppUsageLimitNotificationDeliveryState): Promise<void> {
  const store = await getSettingsStore();
  await store.set(STATE_KEY, { localDate: state.localDate, lastCapturedAt: state.lastCapturedAt, dailySecondsByAppId: state.dailySecondsByAppId, deliveryState });
  await store.save();
}
