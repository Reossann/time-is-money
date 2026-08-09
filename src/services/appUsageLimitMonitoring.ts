import { getActiveWindowInfo } from "./activityService";
import { appUsageLimitSettingsRepository } from "../repositories/appUsageLimitSettingsRepository";
import { sendAppUsageLimitNotification } from "./appUsageLimitNotificationSender";
import { processAppUsageLimitObservation } from "./appUsageLimitMonitorService";
import { createInitialAppUsageLimitState } from "./appUsageLimitStateService";
import type { AppUsageLimitNotificationDeliveryState } from "./appUsageLimitCooldownService";
import type { AppUsageLimitState } from "../types/appUsageLimitState";
import { createNormalizedDesktopAppId } from "../utils/hourlyRateSettingsSchemas";
import { loadAppUsageLimitRuntime, saveAppUsageLimitRuntime } from "../repositories/appUsageLimitStateRepository";

const POLL_INTERVAL_MS = 1_000;
const SETTINGS_REFRESH_INTERVAL = 10;

function localDate(): string {
  return new Date().toLocaleDateString("sv-SE");
}

export async function startAppUsageLimitMonitoring(): Promise<() => void> {
  let settings = await appUsageLimitSettingsRepository.load();
  const runtime = await loadAppUsageLimitRuntime(localDate());
  let state: AppUsageLimitState | null = runtime.state;
  // 通知履歴は送信結果とOS側の表示状態が一致しない場合があるため、起動時はリセットする。
  // 日次利用累計（runtime.state）は引き続き復元する。
  let deliveryState: AppUsageLimitNotificationDeliveryState = {};
  let stopped = false;
  let pollCount = 0;
  let lastLoggedAppId: string | null | undefined;
  console.info("利用制限監視を開始しました", settings.desktopApps.map((setting) => ({ appId: setting.appId, processName: setting.processName, enabled: setting.enabled })));

  const poll = async () => {
    if (stopped) return;
    try {
      pollCount += 1;
      if (pollCount % SETTINGS_REFRESH_INTERVAL === 0) {
        settings = await appUsageLimitSettingsRepository.load();
      }
      const activeWindow = await getActiveWindowInfo();
      const appId = activeWindow === null ? null : createNormalizedDesktopAppId(activeWindow.processName);
      if (appId !== lastLoggedAppId) {
        console.info("利用制限監視の前面アプリ", { processName: activeWindow?.processName ?? null, appId });
        lastLoggedAppId = appId;
      }
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
      const activeRule = settings.desktopApps.find((setting) => setting.appId === appId);
      if (activeRule !== undefined) {
        console.info("利用制限監視の判定値", {
          appId: activeRule.appId,
          dailySeconds: state.dailySecondsByAppId[activeRule.appId] ?? 0,
          dailyLimitSeconds: activeRule.dailyLimitSeconds,
          continuousSeconds: state.continuousSeconds,
          continuousLimitSeconds: activeRule.continuousLimitSeconds,
          enabled: activeRule.enabled,
          sentCount: result.sentCount,
        });
      }
      if (result.sentCount > 0) console.info("利用制限通知を送信しました", { sentCount: result.sentCount, appId });
      await saveAppUsageLimitRuntime(state, deliveryState);
    } catch (error) {
      // A transient foreground-window or notification error must not stop monitoring.
      console.error("利用制限監視の1回分の処理に失敗しました", error);
    }
  };

  const intervalId = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
  void poll();
  return () => {
    stopped = true;
    window.clearInterval(intervalId);
  };
}
