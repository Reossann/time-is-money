/* eslint-env browser, webextensions */
/* global chrome, console */
/**
 * Chrome拡張機能 - Background Service Worker
 * アクティブなタブのURLを定期的に監視し、Tauriに送信
 */

// ネイティブメッセージング用のホスト名
const NATIVE_HOST = "com.timeismoney.app";

// 前のアクティブなタブの URL
let previousActiveUrl = null;

// 監視を開始しているかどうか
let isMonitoring = false;

/**
 * アクティブなタブの URL を取得
 */
async function getActiveTabUrl() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      console.warn("アクティブなタブが見つかりません");
      return null;
    }

    const activeTab = tabs[0];
    const url = activeTab.url;

    // chrome:// などのシステムページをフィルタ
    if (!url || url.startsWith("chrome://")) {
      return null;
    }

    return url;
  } catch (error) {
    console.error("アクティブなタブ URL の取得に失敗:", error);
    return null;
  }
}

/**
 * Tauri にネイティブメッセージを送信
 * @param {string} url - ウェブアプリの URL
 */
function sendUrlToTauri(url) {
  try {
    const message = {
      type: "URL_CHANGE",
      url: url,
      timestamp: Date.now(),
    };

    chrome.runtime.sendNativeMessage(
      NATIVE_HOST,
      message,
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Tauri との通信エラー:",
            chrome.runtime.lastError.message
          );
          return;
        }

        console.log("Tauri からの応答:", response);
      }
    );
  } catch (error) {
    console.error("ネイティブメッセージ送信エラー:", error);
  }
}

/**
 * タブの URL 変更を監視
 */
function startMonitoring() {
  if (isMonitoring) {
    return;
  }

  isMonitoring = true;
  console.log("Web Tracker 監視を開始");

  // 初期状態を取得
  getActiveTabUrl().then((url) => {
    if (url) {
      previousActiveUrl = url;
      sendUrlToTauri(url);
    }
  });

  // アクティブなタブが変更された時
  chrome.tabs.onActivated.addListener(async () => {
    const url = await getActiveTabUrl();

    if (url && url !== previousActiveUrl) {
      console.log("タブ切り替わり検出:", url);
      previousActiveUrl = url;
      sendUrlToTauri(url);
    }
  });

  // タブの URL が更新された時
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.active && tab.url) {
      if (tab.url !== previousActiveUrl && !tab.url.startsWith("chrome://")) {
        console.log("URL 更新検出:", tab.url);
        previousActiveUrl = tab.url;
        sendUrlToTauri(tab.url);
      }
    }
  });
}

// Service Worker 起動時に監視を開始
startMonitoring();

// popup から監視状態を確認するためのメッセージハンドラ
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getStatus") {
    sendResponse({
      isMonitoring: isMonitoring,
      currentUrl: previousActiveUrl,
    });
  }
});
