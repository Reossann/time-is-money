import { invoke } from "@tauri-apps/api/core";

import type { AppUsageLimitNotificationEvent } from "../types/appUsageLimit";

export function appUsageLimitNotificationMessage(
  event: Pick<AppUsageLimitNotificationEvent, "kind" | "notification">,
): string {
  const messages = {
    daily: {
      "remaining-15-minutes": "今日の利用時間は残り15分！",
      "remaining-5-minutes": "今日の利用時間は残り5分！",
      reached: "今日の利用時間制限に達しました！",
      "exceeded-5-minutes": "今日の利用時間制限を5分超過しました！",
      "exceeded-15-minutes": "今日の利用時間制限を15分超過しました！",
    },
    continuous: {
      "remaining-15-minutes": "連続利用時間の制限まで残り15分！",
      "remaining-5-minutes": "連続利用時間の制限まで残り5分！",
      reached: "連続利用時間の制限に達しました！",
      "exceeded-5-minutes": "連続利用時間の制限を5分超過しました！",
      "exceeded-15-minutes": "連続利用時間の制限を15分超過しました！",
    },
  } as const;
  return messages[event.kind][event.notification];
}

export async function sendAppUsageLimitNotification(
  appName: string,
  event: AppUsageLimitNotificationEvent,
): Promise<void> {
  await invoke("send_app_usage_limit_notification", {
    appName,
    kind: event.kind,
    notification: appUsageLimitNotificationMessage(event),
  });
}
