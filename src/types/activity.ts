export type ActivityCategory = "productive" | "waste" | "neutral";

export type ActivityRecord = {
  id: string;
  processName: string;
  windowTitle: string;
  category: ActivityCategory;
  startedAt: number;
  endedAt: number | null;
  durationSeconds: number;
  hourlyRate: number;
  calculatedCost: number;
};

export type AppRule = {
  id: string;
  matchType: "process" | "title" | "domain";
  matchValue: string;
  category: ActivityCategory;
};

export type ActiveWindowInfo = {
  processName: string;
  windowTitle: string;
  processId: number;
};

/**
 * ウェブアプリケーション情報
 * Chrome等のブラウザで使用されているウェブアプリの情報
 */
export type WebApp = {
  id: string;                    // 一意識別子（ドメイン等をベースに生成）
  name: string;                  // 表示名（"Google Docs", "Gmail" など）
  url: string;                   // 完全なURL
  domain: string;                // ドメイン（"docs.google.com" など）
  category?: ActivityCategory;   // カテゴリ（将来的に自動判定）
};

/**
 * ウェブアプリ利用セッション
 * 1つのウェブアプリの開始から終了までの一連の利用時間
 */
export type WebAppSession = {
  id: string;                    // セッション一意識別子
  webAppId: string;              // WebApp.id への参照
  webAppName: string;            // スナップショット：利用時のウェブアプリ名
  startedAt: number;             // 開始時刻（Unix timestamp in ms）
  endedAt: number | null;        // 終了時刻（null = 計測中）
  durationSeconds: number;       // 利用時間（秒）
};

/**
 * ウェブアプリの累積利用時間
 */
export type WebAppUsageStats = {
  webAppId: string;
  webAppName: string;
  cumulativeSeconds: number;     // 累積利用時間（秒）
  sessionCount: number;          // セッション数
};

export type NativeWebAppEvent =
  | {
      type: "URL_CHANGE";
      url: string;
      timestamp: number;
    }
  | {
      type: "TRACKING_STOP";
      timestamp: number;
    };
