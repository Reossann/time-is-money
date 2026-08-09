import type {
  AppUsageLimitKind,
  AppUsageLimitNotification,
  AppUsageLimitNotificationEvent,
} from "../types/appUsageLimit";

const MINUTES_15_SECONDS = 15 * 60;
const MINUTES_5_SECONDS = 5 * 60;

type NotificationThreshold = Readonly<{
  notification: AppUsageLimitNotification;
  offsetSeconds: number;
  minimumLimitSeconds?: number;
}>;

const thresholds: readonly NotificationThreshold[] = [
  {
    notification: "remaining-15-minutes",
    offsetSeconds: -MINUTES_15_SECONDS,
    minimumLimitSeconds: MINUTES_15_SECONDS,
  },
  {
    notification: "remaining-5-minutes",
    offsetSeconds: -MINUTES_5_SECONDS,
    minimumLimitSeconds: MINUTES_5_SECONDS,
  },
  { notification: "reached", offsetSeconds: 0 },
  { notification: "exceeded-5-minutes", offsetSeconds: MINUTES_5_SECONDS },
  { notification: "exceeded-15-minutes", offsetSeconds: MINUTES_15_SECONDS },
];

function crossed(previousUsedSeconds: number, usedSeconds: number, thresholdSeconds: number): boolean {
  return previousUsedSeconds < thresholdSeconds && usedSeconds >= thresholdSeconds;
}

/**
 * Returns every notification boundary crossed since the previous sample.
 * A limit shorter than a lead time does not produce an impossible lead-time event.
 */
export function evaluateAppUsageLimitNotifications(
  kind: AppUsageLimitKind,
  limitSeconds: number,
  previousUsedSeconds: number,
  usedSeconds: number,
): AppUsageLimitNotificationEvent[] {
  if (
    !Number.isFinite(limitSeconds) ||
    !Number.isFinite(previousUsedSeconds) ||
    !Number.isFinite(usedSeconds) ||
    limitSeconds <= 0 ||
    previousUsedSeconds < 0 ||
    usedSeconds < previousUsedSeconds
  ) {
    return [];
  }

  return thresholds.flatMap(({ notification, offsetSeconds, minimumLimitSeconds }) => {
    if (minimumLimitSeconds !== undefined && limitSeconds < minimumLimitSeconds) {
      return [];
    }

    const thresholdSeconds = limitSeconds + offsetSeconds;
    if (!crossed(previousUsedSeconds, usedSeconds, thresholdSeconds)) return [];

    return [{ kind, notification, limitSeconds, usedSeconds }];
  });
}
