import { create } from "zustand";
import type { WebApp, WebAppSession, WebAppUsageStats } from "../types/activity";

export type NativeBridgeStatus = "waiting" | "connected" | "invalid-event";

function createWebAppSession(webApp: WebApp, startedAt: number): WebAppSession {
  return {
    id: `session-${startedAt}-${Math.random()}`,
    webAppId: webApp.id,
    webAppName: webApp.name,
    startedAt,
    endedAt: null,
    durationSeconds: 0,
  };
}

function getDurationSeconds(startedAt: number, endedAt: number): number {
  return Math.max(0, Math.floor((endedAt - startedAt) / 1000));
}

type WebAppStoreState = {
  // 現在のセッション情報
  currentSession: WebAppSession | null;
  
  // 今日のウェブアプリ別利用時間
  usageStats: WebAppUsageStats[];
  
  // ウェブアプリ一覧
  webApps: WebApp[];

  // Native Messaging連携状態
  nativeBridgeStatus: NativeBridgeStatus;
  lastNativeEventAt: number | null;
  
  // アクション
  setCurrentWebApp: (webApp: WebApp) => void;
  endCurrentSession: () => void;
  addWebApp: (webApp: WebApp) => void;
  setNativeBridgeStatus: (
    status: NativeBridgeStatus,
    receivedAt?: number,
  ) => void;
  resetUsageStats: () => void;
};

export const useWebAppStore = create<WebAppStoreState>((set, get) => ({
  currentSession: null,
  usageStats: [],
  webApps: [],
  nativeBridgeStatus: "waiting",
  lastNativeEventAt: null,

  setCurrentWebApp: (webApp: WebApp) => {
    const { currentSession } = get();
    if (
      currentSession &&
      currentSession.endedAt === null &&
      currentSession.webAppId === webApp.id
    ) {
      return;
    }

    const now = Date.now();
    const nextSession = createWebAppSession(webApp, now);

    set((state) => {
      const nextUsageStats = state.usageStats.map((stat) => {
        if (!currentSession || currentSession.endedAt !== null) {
          return stat;
        }

        if (stat.webAppId !== currentSession.webAppId) {
          return stat;
        }

        const durationSeconds = getDurationSeconds(currentSession.startedAt, now);

        return {
          ...stat,
          cumulativeSeconds: stat.cumulativeSeconds + durationSeconds,
        };
      });

      const existingStats = nextUsageStats.find((s) => s.webAppId === webApp.id);

      return {
        currentSession: nextSession,
        usageStats: existingStats
          ? nextUsageStats.map((stat) =>
              stat.webAppId === webApp.id
                ? {
                    ...stat,
                    sessionCount: stat.sessionCount + 1,
                  }
                : stat,
            )
          : [
              ...nextUsageStats,
              {
                webAppId: webApp.id,
                webAppName: webApp.name,
                cumulativeSeconds: 0,
                sessionCount: 1,
              },
            ],
      };
    });
  },

  endCurrentSession: () => {
    const { currentSession } = get();
    if (currentSession && currentSession.endedAt === null) {
      const endedAt = Date.now();
      const durationSeconds = getDurationSeconds(currentSession.startedAt, endedAt);

      set((state) => ({
        currentSession: {
          ...currentSession,
          endedAt,
          durationSeconds,
        },
        usageStats: state.usageStats.map((stat) =>
          stat.webAppId === currentSession.webAppId
            ? {
                ...stat,
                cumulativeSeconds: stat.cumulativeSeconds + durationSeconds,
              }
            : stat
        ),
      }));
    }
  },

  addWebApp: (webApp: WebApp) => {
    set((state) => {
      const exists = state.webApps.some((app) => app.id === webApp.id);
      return {
        webApps: exists ? state.webApps : [...state.webApps, webApp],
      };
    });
  },

  setNativeBridgeStatus: (status, receivedAt = Date.now()) => {
    set({
      nativeBridgeStatus: status,
      lastNativeEventAt: status === "waiting" ? null : receivedAt,
    });
  },

  resetUsageStats: () => {
    set({
      currentSession: null,
      usageStats: [],
    });
  },
}));
