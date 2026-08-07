import type { WebApp } from "../types/activity";

/**
 * ウェブアプリの定義
 * URLのドメインから表示名を決めるためのマッピング。
 * pathはページ名や文書IDを含み得るため、計測キーに使わない。
 */
const WEB_DOMAIN_DATABASE: Array<{
  name: string;
  domain: string;
  domains: string[];
}> = [
  {
    name: "Google Workspace",
    domain: "docs.google.com",
    domains: ["docs.google.com"],
  },
  {
    name: "Gmail",
    domain: "mail.google.com",
    domains: ["mail.google.com"],
  },
  {
    name: "Google Drive",
    domain: "drive.google.com",
    domains: ["drive.google.com"],
  },
  {
    name: "Slack",
    domain: "app.slack.com",
    domains: ["slack.com"],
  },
  {
    name: "Notion",
    domain: "notion.so",
    domains: ["notion.so", "app.notionforms.com"],
  },
  {
    name: "GitHub",
    domain: "github.com",
    domains: ["github.com"],
  },
  {
    name: "YouTube",
    domain: "youtube.com",
    domains: ["youtube.com", "youtu.be"],
  },
  {
    name: "X（旧Twitter）",
    domain: "x.com",
    domains: ["x.com", "twitter.com"],
  },
  {
    name: "ChatGPT",
    domain: "chatgpt.com",
    domains: ["chatgpt.com", "chat.openai.com"],
  },
  {
    name: "Claude",
    domain: "claude.ai",
    domains: ["claude.ai"],
  },
];

function matchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function getTrackedDomain(hostname: string): {
  name: string;
  domain: string;
} {
  for (const app of WEB_DOMAIN_DATABASE) {
    if (app.domains.some((domain) => matchesDomain(hostname, domain))) {
      return { name: app.name, domain: app.domain };
    }
  }

  return { name: hostname, domain: hostname };
}

/**
 * URLからChromeサイトをドメイン単位で判定する。
 * URLのpath・query・hashはWebAppへ保持しない。
 */
export function detectWebApp(url: string): WebApp | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return null;
    }

    const hostname = urlObj.hostname.toLowerCase();
    const trackedDomain = getTrackedDomain(hostname);

    return {
      id: `web-domain:${trackedDomain.domain}`,
      name: trackedDomain.name,
      url: `https://${trackedDomain.domain}/`,
      domain: trackedDomain.domain,
    };
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
  return WEB_DOMAIN_DATABASE.map((app) => ({
    id: `web-domain:${app.domain}`,
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
