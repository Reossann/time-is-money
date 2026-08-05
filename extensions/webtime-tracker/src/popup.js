/* eslint-env browser, webextensions */
/* global chrome, console, document, setInterval, URL */
/**
 * Chrome拡張機能 - Popup UI
 * 現在のモニタリング状況とウェブアプリを表示
 */

const statusElement = document.getElementById("status");
const appNameElement = document.getElementById("app-name");
const appUrlElement = document.getElementById("app-url");

/**
 * UI を更新
 */
async function updateUI() {
  try {
    // Background Service Worker から状態を取得
    chrome.runtime.sendMessage(
      { action: "getStatus" },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Background との通信エラー:", chrome.runtime.lastError);
          statusElement.textContent = "エラー: 接続に失敗しました";
          return;
        }

        // 監視状況を表示
        statusElement.textContent = response.isMonitoring
          ? "✅ 計測中"
          : "⏸ 停止中";

        // 現在のアプリを表示
        if (response.currentUrl) {
          updateAppDisplay(response.currentUrl);
        } else {
          appNameElement.textContent = "アプリを検出中...";
          appUrlElement.textContent = "";
        }
      }
    );
  } catch (error) {
    console.error("UI 更新エラー:", error);
    statusElement.textContent = "エラーが発生しました";
  }
}

/**
 * アプリ情報を表示
 * @param {string} url - ウェブアプリの URL
 */
function updateAppDisplay(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // ホスト名からアプリ名を推測
    const appName = inferAppName(hostname);

    appNameElement.textContent = appName;
    appUrlElement.textContent = url;
  } catch (error) {
    console.error("URL 解析エラー:", error);
    appNameElement.textContent = "不明なアプリ";
    appUrlElement.textContent = url;
  }
}

/**
 * ホスト名からアプリ名を推測
 * @param {string} hostname - ホスト名
 * @returns {string} アプリ名
 */
function inferAppName(hostname) {
  // 主要なウェブアプリのマッピング
  const appMappings = {
    "docs.google.com": "Google Docs",
    "sheets.google.com": "Google Sheets",
    "mail.google.com": "Gmail",
    "drive.google.com": "Google Drive",
    "slack.com": "Slack",
    "notion.so": "Notion",
    "github.com": "GitHub",
    "youtube.com": "YouTube",
    "x.com": "X (Twitter)",
    "chatgpt.com": "ChatGPT",
    "claude.ai": "Claude",
  };

  // 完全一致を確認
  if (appMappings[hostname]) {
    return appMappings[hostname];
  }

  // パーシャルマッチを確認
  for (const [key, value] of Object.entries(appMappings)) {
    if (hostname.includes(key)) {
      return value;
    }
  }

  // マッピングにない場合、ホスト名をそのまま返す
  return hostname;
}

// Popup が開かれた時に UI を更新
updateUI();

// 1秒ごとに UI を更新（リアルタイム表示）
setInterval(updateUI, 1000);
