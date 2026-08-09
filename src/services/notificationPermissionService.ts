import { invoke } from "@tauri-apps/api/core";

export type NotificationPermissionState = "granted" | "denied" | "prompt" | "unknown";

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  const state = await invoke<string>("plugin:notification|permission_state");
  return normalizePermissionState(state);
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  const state = await invoke<string>("plugin:notification|request_permission");
  return normalizePermissionState(state);
}

function normalizePermissionState(state: string): NotificationPermissionState {
  if (state === "granted" || state === "denied" || state === "prompt") return state;
  if (state === "prompt-with-rationale") return "prompt";
  return "unknown";
}

export function notificationPermissionGuideMessage(state: NotificationPermissionState): string | null {
  if (state === "denied") {
    return "通知が許可されていません。Windowsの設定からTime Is Moneyの通知を許可してください。";
  }
  return null;
}
