import { listen } from "@tauri-apps/api/event";

import { detectWebApp } from "./webAppService";
import { useWebAppStore } from "../stores/useWebAppStore";
import { nativeWebAppChangeSchema } from "../utils/schemas";

export const NATIVE_WEB_APP_CHANGE_RECEIVED_EVENT =
  "native-web-app-change";

/**
 * Tauri から届いた Native Messaging 由来の URL 変更を受け取り、
 * 既存の WebApp ストアへ流し込む。
 */
export async function startNativeWebAppBridgeListener(): Promise<() => void> {
  return listen<unknown>(
    NATIVE_WEB_APP_CHANGE_RECEIVED_EVENT,
    ({ payload }) => {
      const parsed = nativeWebAppChangeSchema.safeParse(payload);

      if (!parsed.success) {
        console.error("Native WebApp event の検証に失敗しました", payload);
        return;
      }

      const webApp = detectWebApp(parsed.data.url);

      if (!webApp) {
        return;
      }

      const webAppStore = useWebAppStore.getState();
      webAppStore.addWebApp(webApp);
      webAppStore.setCurrentWebApp(webApp);
    },
  );
}
