import type { WebApp } from "../types/activity";

/**
 * ウェブアプリの定義
 * URLのドメイン/パターンからアプリを判定するためのマッピング
 */
const WEB_APPS_DATABASE: Array<{
  id: string;
  name: string;
  domain: string;
  domains: string[];
  pathPrefixes?: string[];
}> = [
  {
    id: "google-docs",
    name: "Google Docs",
    domain: "docs.google.com",
    domains: ["docs.google.com"],
    pathPrefixes: ["/document"],
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    domain: "docs.google.com",
    domains: ["docs.google.com"],
    pathPrefixes: ["/spreadsheets"],
  },
  {
    id: "google-slides",
    name: "Google Slides",
    domain: "docs.google.com",
    domains: ["docs.google.com"],
    pathPrefixes: ["/presentation"],
  },
  {
    id: "gmail",
    name: "Gmail",
    domain: "mail.google.com",
    domains: ["mail.google.com"],
  },
  {
    id: "google-drive",
    name: "Google Drive",
    domain: "drive.google.com",
    domains: ["drive.google.com"],
  },
  {
    id: "slack",
    name: "Slack",
    domain: "app.slack.com",
    domains: ["slack.com"],
  },
  {
    id: "notion",
    name: "Notion",
    domain: "notion.so",
    domains: ["notion.so", "app.notionforms.com"],
  },
  {
    id: "github",
    name: "GitHub",
    domain: "github.com",
    domains: ["github.com"],
  },
  {
    id: "youtube",
    name: "YouTube",
    domain: "youtube.com",
    domains: ["youtube.com", "youtu.be"],
  },
  {
    id: "twitter",
    name: "X（旧Twitter）",
    domain: "x.com",
    domains: ["x.com", "twitter.com"],
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    domain: "chatgpt.com",
    domains: ["chatgpt.com", "chat.openai.com"],
  },
  {
    id: "claude",
    name: "Claude",
    domain: "claude.ai",
    domains: ["claude.ai"],
  },
];

function matchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * URLからウェブアプリを判定
 * @param url - ウェブアプリのURL
 * @returns WebApp情報、または判定できない場合はnull
 */
export function detectWebApp(url: string): WebApp | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // マッピングからマッチするアプリを検索
    for (const app of WEB_APPS_DATABASE) {
      const domainMatches = app.domains.some((domain) =>
        matchesDomain(hostname, domain),
      );
      const pathMatches =
        !app.pathPrefixes ||
        app.pathPrefixes.some((prefix) => urlObj.pathname.startsWith(prefix));

      if (domainMatches && pathMatches) {
        return {
          id: app.id,
          name: app.name,
          url,
          domain: app.domain,
        };
      }
    }

    // マッチしない場合は null を返す
    return null;
  } catch {
    console.error("detectWebApp: URLの解析に失敗しました");
    return null;
  }
}

/**
 * URLからドメイン名を抽出
 * @param url - ウェブアプリのURL
 * @returns ドメイン名、または抽出できない場合は空文字列
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    console.error("extractDomain: URLの解析に失敗しました");
    return "";
  }
}

/**
 * 登録済みのウェブアプリ一覧を取得
 * @returns WebApp 情報の配列
 */
export function getRegisteredWebApps(): WebApp[] {
  return WEB_APPS_DATABASE.map((app) => ({
    id: app.id,
    name: app.name,
    domain: app.domain,
    url: `https://${app.domain}`,
  }));
}

/**
 * セッションの経過時間（秒）を計算
 * @param startedAt - セッション開始時刻（Unix timestamp in ms）
 * @returns 経過時間（秒）
 */
export function calculateSessionDuration(startedAt: number): number {
  try {
    const now = Date.now();
    if (startedAt > now) {
      throw new Error(
        `calculateSessionDuration: startedAt が未来の時刻です。受け取った値: ${startedAt}`
      );
    }

    const durationMs = now - startedAt;
    const durationSeconds = Math.floor(durationMs / 1000);

    if (durationSeconds < 0) {
      throw new Error(
        `calculateSessionDuration: 経過時間が負の値です。受け取った値: ${durationSeconds}`
      );
    }

    return durationSeconds;
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "セッション時間の計算に失敗しました";
    console.error(errorMsg);
    return 0;
  }
}

/**
 * ウェブアプリの変更を検出
 * @param currentUrl - 現在のURL
 * @param previousWebAppId - 前のウェブアプリID
 * @returns ウェブアプリが変更されたか
 */
export function hasWebAppChanged(
  currentUrl: string,
  previousWebAppId: string | null
): boolean {
  try {
    const currentWebApp = detectWebApp(currentUrl);

    if (currentWebApp === null) {
      return previousWebAppId !== null;
    }

    return currentWebApp.id !== previousWebAppId;
  } catch {
    console.error("hasWebAppChanged: URLの判定に失敗しました");
    return false;
  }
}

/**
 * 利用時間をフォーマット（"HH:MM:SS" 形式）
 * @param seconds - 秒数
 * @returns フォーマットされた時間文字列
 */
export function formatSessionDuration(seconds: number): string {
  try {
    if (typeof seconds !== "number") {
      throw new Error(
        `formatSessionDuration: 入力値は数値である必要があります。受け取った型: ${typeof seconds}`
      );
    }

    if (!Number.isFinite(seconds)) {
      throw new Error(
        `formatSessionDuration: 入力値は有限の数値である必要があります。受け取った値: ${seconds}`
      );
    }

    if (seconds < 0) {
      throw new Error(
        `formatSessionDuration: 入力値は 0 以上である必要があります。受け取った値: ${seconds}`
      );
    }

    const wholeSeconds = Math.floor(seconds);
    const hours = Math.floor(wholeSeconds / 3600);
    const minutes = Math.floor((wholeSeconds % 3600) / 60);
    const secs = wholeSeconds % 60;

    return [
      String(hours).padStart(2, "0"),
      String(minutes).padStart(2, "0"),
      String(secs).padStart(2, "0"),
    ].join(":");
  } catch (err) {
    const errorMsg =
      err instanceof Error
        ? err.message
        : "利用時間のフォーマットに失敗しました";
    console.error(errorMsg);
    return "00:00:00";
  }
}
