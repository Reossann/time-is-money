import { create } from "zustand";
import type { WebApp, WebAppSession, WebAppUsageStats } from "../types/activity";

type WebAppStoreState = {
  // 現在のセッション情報
  currentSession: WebAppSession | null;
  
  // 今日のウェブアプリ別利用時間
  usageStats: WebAppUsageStats[];
  
  // ウェブアプリ一覧
  webApps: WebApp[];
  
  // アクション
  setCurrentWebApp: (webApp: WebApp) => void;
  endCurrentSession: () => void;
  addWebApp: (webApp: WebApp) => void;
  resetUsageStats: () => void;
};

export const useWebAppStore = create<WebAppStoreState>((set, get) => ({
  currentSession: null,
  usageStats: [],
  webApps: [],

  setCurrentWebApp: (webApp: WebApp) => {
    // 現在のセッションを終了
    const { currentSession } = get();
    if (currentSession && currentSession.endedAt === null) {
      const endedAt = Date.now();
      const durationSeconds = Math.floor((endedAt - currentSession.startedAt) / 1000);

      set((state) => ({
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

    // 新しいセッションを開始
    const newSession: WebAppSession = {
      id: `session-${Date.now()}-${Math.random()}`,
      webAppId: webApp.id,
      webAppName: webApp.name,
      startedAt: Date.now(),
      endedAt: null,
      durationSeconds: 0,
    };

    set((state) => {
      const existingStats = state.usageStats.find((s) => s.webAppId === webApp.id);

      return {
        currentSession: newSession,
        usageStats: existingStats
          ? state.usageStats
          : [
              ...state.usageStats,
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
      const durationSeconds = Math.floor((endedAt - currentSession.startedAt) / 1000);

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

  resetUsageStats: () => {
    set({
      currentSession: null,
      usageStats: [],
    });
  },
}));
