import type { AppUsageLimitSettings } from "../types/appUsageLimitSettings";
import type { AppUsageObservation, AppUsageLimitState } from "../types/appUsageLimitState";
import {
  type AppUsageLimitNotificationDeliveryState,
  canDeliverAppUsageLimitNotification,
  recordAppUsageLimitNotificationDelivery,
  resetAppUsageLimitNotificationDelivery,
} from "./appUsageLimitCooldownService";
import {
  evaluateConfiguredAppUsageLimits,
  type AppUsageLimitNotificationKey,
} from "./appUsageLimitNotificationService";
import { advanceAppUsageLimitState } from "./appUsageLimitStateService";

export type AppUsageLimitNotificationSender = (
  appName: string,
  event: Parameters<typeof import("./appUsageLimitNotificationSender").sendAppUsageLimitNotification>[1],
) => Promise<void>;

export type AppUsageLimitMonitorResult = Readonly<{
  state: AppUsageLimitState;
  deliveryState: AppUsageLimitNotificationDeliveryState;
  sentCount: number;
}>;

export async function processAppUsageLimitObservation(
  previousState: AppUsageLimitState,
  observation: AppUsageObservation,
  settings: AppUsageLimitSettings,
  deliveryState: AppUsageLimitNotificationDeliveryState,
  send: AppUsageLimitNotificationSender,
): Promise<AppUsageLimitMonitorResult> {
  const state = advanceAppUsageLimitState(previousState, observation);
  const dateChanged = previousState.localDate !== state.localDate;
  let nextDeliveryState = resetAppUsageLimitNotificationDelivery(deliveryState, dateChanged);
  const evaluation = evaluateConfiguredAppUsageLimits(previousState, state, settings);
  if (evaluation.events.length > 0) {
    console.info("利用制限監視の通知イベント", evaluation.events.map((event) => ({ appId: event.appId, kind: event.kind, notification: event.notification })));
  }
  const appNames = new Map(settings.desktopApps.map((setting) => [setting.appId, setting.processName]));
  const nowSeconds = Math.floor(state.lastCapturedAt / 1000);
  let sentCount = 0;

  for (const event of evaluation.events) {
    const setting = settings.desktopApps.find((candidate) => candidate.appId === event.appId);
    if (setting === undefined) continue;
    const notificationKey = `${event.appId}:${event.kind}:${event.notification}` as AppUsageLimitNotificationKey;
    if (!canDeliverAppUsageLimitNotification(notificationKey, nowSeconds, setting.cooldownSeconds, nextDeliveryState)) continue;
    await send(appNames.get(event.appId) ?? event.appId, event);
    nextDeliveryState = recordAppUsageLimitNotificationDelivery(notificationKey, nowSeconds, nextDeliveryState);
    sentCount += 1;
  }

  return { state, deliveryState: nextDeliveryState, sentCount };
}
