import type { AppUsageLimitNotificationEvent } from "../types/appUsageLimit";
import type { AppUsageLimitSettings } from "../types/appUsageLimitSettings";
import type { AppUsageLimitState } from "../types/appUsageLimitState";
import { evaluateAppUsageLimitNotifications } from "./appUsageLimitEvaluationService";

export type AppUsageLimitNotificationKey = `${string}:${"daily" | "continuous"}:${string}`;

export type AppUsageLimitNotificationEvaluation = Readonly<{
  events: ReadonlyArray<AppUsageLimitNotificationEvent & { appId: string }>;
  notifiedKeys: ReadonlySet<AppUsageLimitNotificationKey>;
}>;

function key(appId: string, kind: "daily" | "continuous", notification: string): AppUsageLimitNotificationKey {
  return `${appId}:${kind}:${notification}`;
}

export function evaluateConfiguredAppUsageLimits(
  previous: AppUsageLimitState,
  current: AppUsageLimitState,
  settings: AppUsageLimitSettings,
  notifiedKeys: ReadonlySet<AppUsageLimitNotificationKey> = new Set(),
): AppUsageLimitNotificationEvaluation {
  if (previous.localDate !== current.localDate) {
    notifiedKeys = new Set();
  }

  const nextKeys = new Set(notifiedKeys);
  const events: Array<AppUsageLimitNotificationEvent & { appId: string }> = [];

  for (const setting of settings.desktopApps) {
    if (!setting.enabled) continue;

    const dailyPrevious = previous.dailySecondsByAppId[setting.appId] ?? 0;
    const dailyCurrent = current.dailySecondsByAppId[setting.appId] ?? 0;
    const continuousPrevious = previous.activeAppId === setting.appId ? previous.continuousSeconds : 0;
    const continuousCurrent = current.activeAppId === setting.appId ? current.continuousSeconds : 0;

    for (const event of evaluateAppUsageLimitNotifications("daily", setting.dailyLimitSeconds, dailyPrevious, dailyCurrent)) {
      const eventKey = key(setting.appId, event.kind, event.notification);
      if (nextKeys.has(eventKey)) continue;
      nextKeys.add(eventKey);
      events.push({ ...event, appId: setting.appId });
    }
    for (const event of evaluateAppUsageLimitNotifications("continuous", setting.continuousLimitSeconds, continuousPrevious, continuousCurrent)) {
      const eventKey = key(setting.appId, event.kind, event.notification);
      if (nextKeys.has(eventKey)) continue;
      nextKeys.add(eventKey);
      events.push({ ...event, appId: setting.appId });
    }
  }

  return { events, notifiedKeys: nextKeys };
}
