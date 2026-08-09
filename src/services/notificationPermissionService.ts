import { invoke } from "@tauri-apps/api/core";

export type NotificationPermissionState = "granted" | "denied" | "prompt" | "unknown";

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  return invoke<NotificationPermissionState>("get_notification_permission_state");
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  return invoke<NotificationPermissionState>("request_notification_permission");
}

export function notificationPermissionGuideMessage(state: NotificationPermissionState): string | null {
  if (state === "denied") {
    return "通知が許可されていません。Windowsの設定からTime Is Moneyの通知を許可してください。";
  }
  return null;
}
