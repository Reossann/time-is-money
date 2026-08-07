import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { detectWebApp } from "./webAppService";
import { useWebAppStore } from "../stores/useWebAppStore";
import { nativeWebAppEventSchema } from "../utils/schemas";

export const NATIVE_WEB_APP_CHANGE_RECEIVED_EVENT =
  "native-web-app-change";

const noop = () => {};

export function handleNativeWebAppEvent(payload: unknown): boolean {
  const parsed = nativeWebAppEventSchema.safeParse(payload);
  const webAppStore = useWebAppStore.getState();

  if (!parsed.success) {
    webAppStore.setNativeBridgeStatus("invalid-event");
    console.error("Native WebApp event の検証に失敗しました");
    return false;
  }

  webAppStore.setNativeBridgeStatus("connected");

  if (parsed.data.type === "TRACKING_STOP") {
    webAppStore.endCurrentSession();
    return true;
  }

  const webApp = detectWebApp(parsed.data.url);

  if (!webApp) {
    webAppStore.endCurrentSession();
    return true;
  }

  webAppStore.addWebApp(webApp);
  webAppStore.setCurrentWebApp(webApp);
  return true;
}

/**
 * Tauri から届いた Native Messaging 由来の URL 変更を受け取り、
 * 既存の WebApp ストアへ流し込む。
 */
export async function startNativeWebAppBridgeListener(): Promise<() => void> {
  if (!isTauri()) {
    return noop;
  }

  const unlisten = await listen<unknown>(
    NATIVE_WEB_APP_CHANGE_RECEIVED_EVENT,
    ({ payload }) => handleNativeWebAppEvent(payload),
  );

  try {
    const latestEvent = await invoke<unknown | null>(
      "get_latest_native_web_app_event",
    );

    if (latestEvent !== null) {
      handleNativeWebAppEvent(latestEvent);
    }
  } catch (error) {
    unlisten();
    throw error;
  }

  return unlisten;
}
