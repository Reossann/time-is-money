import { getActiveWindowInfo } from "./activityService";
import { appUsageLimitSettingsRepository } from "../repositories/appUsageLimitSettingsRepository";
import { sendAppUsageLimitNotification } from "./appUsageLimitNotificationSender";
import { processAppUsageLimitObservation } from "./appUsageLimitMonitorService";
import { createInitialAppUsageLimitState } from "./appUsageLimitStateService";
import type { AppUsageLimitNotificationDeliveryState } from "./appUsageLimitCooldownService";
import type { AppUsageLimitState } from "../types/appUsageLimitState";
import { createNormalizedDesktopAppId } from "../utils/hourlyRateSettingsSchemas";

const POLL_INTERVAL_MS = 1_000;
const SETTINGS_REFRESH_INTERVAL = 10;

function localDate(): string {
  return new Date().toLocaleDateString("sv-SE");
}

export async function startAppUsageLimitMonitoring(): Promise<() => void> {
  let settings = await appUsageLimitSettingsRepository.load();
  let state: AppUsageLimitState | null = null;
  let deliveryState: AppUsageLimitNotificationDeliveryState = {};
  let stopped = false;
  let pollCount = 0;

  const poll = async () => {
    if (stopped) return;
    try {
      pollCount += 1;
      if (pollCount % SETTINGS_REFRESH_INTERVAL === 0) {
        settings = await appUsageLimitSettingsRepository.load();
      }
      const activeWindow = await getActiveWindowInfo();
      const appId = activeWindow === null ? null : createNormalizedDesktopAppId(activeWindow.processName);
      const observation = { localDate: localDate(), capturedAt: Date.now(), appId };
      if (state === null) {
        state = createInitialAppUsageLimitState(observation);
        return;
      }
      const result = await processAppUsageLimitObservation(
        state,
        observation,
        settings,
        deliveryState,
        sendAppUsageLimitNotification,
      );
      state = result.state;
      deliveryState = result.deliveryState;
    } catch {
      // A transient foreground-window or notification error must not stop monitoring.
    }
  };

  const intervalId = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
  void poll();
  return () => {
    stopped = true;
    window.clearInterval(intervalId);
  };
}
