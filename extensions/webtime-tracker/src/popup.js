import { inferAppName } from "./tracking-utils.js";
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

        const statusLabels = {
          connected: "✅ アプリ接続済み",
          monitoring: "⏳ 接続確認中",
          "host-unregistered": "⚠️ Native Host未登録",
          "app-unavailable": "⚠️ Time Is Moneyが未起動",
          "send-failed": "⚠️ アプリへの送信失敗",
        };

        statusElement.textContent = response.isMonitoring
          ? (statusLabels[response.connectionState] ?? "⏳ 接続確認中")
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
    const appName = inferAppName(url);

    appNameElement.textContent = appName;
    appUrlElement.textContent = url;
  } catch (error) {
    console.error("URL 解析エラー:", error);
    appNameElement.textContent = "不明なアプリ";
    appUrlElement.textContent = url;
  }
}

// Popup が開かれた時に UI を更新
updateUI();

// 1秒ごとに UI を更新（リアルタイム表示）
setInterval(updateUI, 1000);
