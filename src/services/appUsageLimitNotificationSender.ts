import { invoke } from "@tauri-apps/api/core";

import type { AppUsageLimitNotificationEvent } from "../types/appUsageLimit";

export async function sendAppUsageLimitNotification(
  appName: string,
  event: AppUsageLimitNotificationEvent,
): Promise<void> {
  await invoke("send_app_usage_limit_notification", {
    appName,
    kind: event.kind,
    notification: event.notification,
  });
}
