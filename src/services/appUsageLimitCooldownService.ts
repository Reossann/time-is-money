import type { AppUsageLimitNotificationKey } from "./appUsageLimitNotificationService";

export type AppUsageLimitNotificationDeliveryState = Readonly<
  Partial<Record<AppUsageLimitNotificationKey, number>>
>;

export function canDeliverAppUsageLimitNotification(
  notificationKey: AppUsageLimitNotificationKey,
  nowSeconds: number,
  cooldownSeconds: number,
  deliveryState: AppUsageLimitNotificationDeliveryState,
): boolean {
  if (!Number.isFinite(nowSeconds) || nowSeconds < 0 || !Number.isFinite(cooldownSeconds) || cooldownSeconds < 0) {
    return false;
  }
  const lastDeliveredAt = deliveryState[notificationKey];
  return lastDeliveredAt === undefined || nowSeconds - lastDeliveredAt >= cooldownSeconds;
}

export function recordAppUsageLimitNotificationDelivery(
  notificationKey: AppUsageLimitNotificationKey,
  deliveredAtSeconds: number,
  deliveryState: AppUsageLimitNotificationDeliveryState,
): AppUsageLimitNotificationDeliveryState {
  if (!Number.isFinite(deliveredAtSeconds) || deliveredAtSeconds < 0) return deliveryState;
  return { ...deliveryState, [notificationKey]: deliveredAtSeconds };
}

export function resetAppUsageLimitNotificationDelivery(
  deliveryState: AppUsageLimitNotificationDeliveryState,
  localDateChanged: boolean,
): AppUsageLimitNotificationDeliveryState {
  return localDateChanged ? {} : deliveryState;
}
