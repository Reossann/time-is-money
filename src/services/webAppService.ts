import type { WebApp } from "../types/activity";

/**
 * ウェブアプリの定義
 * URLのドメイン/パターンからアプリを判定するためのマッピング
 */
const WEB_APPS_DATABASE: Array<{
  id: string;
  name: string;
  domain: string;
  patterns: RegExp[];
}> = [
  {
    id: "google-docs",
    name: "Google Docs",
    domain: "docs.google.com",
    patterns: [/docs\.google\.com\/document/],
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    domain: "docs.google.com",
    patterns: [/docs\.google\.com\/spreadsheets/],
  },
  {
    id: "google-slides",
    name: "Google Slides",
    domain: "docs.google.com",
    patterns: [/docs\.google\.com\/presentation/],
  },
  {
    id: "gmail",
    name: "Gmail",
    domain: "mail.google.com",
    patterns: [/mail\.google\.com/],
  },
  {
    id: "google-drive",
    name: "Google Drive",
    domain: "drive.google.com",
    patterns: [/drive\.google\.com/],
  },
  {
    id: "slack",
    name: "Slack",
    domain: "app.slack.com",
    patterns: [/app\.slack\.com/],
  },
  {
    id: "notion",
    name: "Notion",
    domain: "notion.so",
    patterns: [/notion\.so/, /app\.notionforms\.com/],
  },
  {
    id: "github",
    name: "GitHub",
    domain: "github.com",
    patterns: [/github\.com/],
  },
  {
    id: "youtube",
    name: "YouTube",
    domain: "youtube.com",
    patterns: [/youtube\.com/, /youtu\.be/],
  },
  {
    id: "twitter",
    name: "X（旧Twitter）",
    domain: "x.com",
    patterns: [/x\.com/, /twitter\.com/],
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    domain: "chatgpt.com",
    patterns: [/chatgpt\.com/, /chat\.openai\.com/],
  },
  {
    id: "claude",
    name: "Claude",
    domain: "claude.ai",
    patterns: [/claude\.ai/],
  },
];

/**
 * URLからウェブアプリを判定
 * @param url - ウェブアプリのURL
 * @returns WebApp情報、または判定できない場合はnull
 */
export function detectWebApp(url: string): WebApp | null {
  try {
    const urlObj = new URL(url);
    const fullUrl = urlObj.toString();

    // マッピングからマッチするアプリを検索
    for (const app of WEB_APPS_DATABASE) {
      for (const pattern of app.patterns) {
        if (pattern.test(fullUrl)) {
          return {
            id: app.id,
            name: app.name,
            url,
            domain: app.domain,
          };
        }
      }
    }

    // マッチしない場合は null を返す
    return null;
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "URLの解析に失敗しました";
    console.error(`detectWebApp エラー: ${errorMsg}`, { url });
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
  } catch (err) {
    console.error("extractDomain エラー", { url });
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
