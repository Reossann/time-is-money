import { getNextTrackedUrl } from "./tracking-utils.js";

const NATIVE_HOST = "com.timeismoney.app";
const PREVIOUS_URL_KEY = "previousActiveUrl";

let isMonitoring = false;

async function getPreviousActiveUrl() {
  const stored = await chrome.storage.session.get(PREVIOUS_URL_KEY);
  return stored[PREVIOUS_URL_KEY] ?? null;
}

async function setPreviousActiveUrl(url) {
  await chrome.storage.session.set({ [PREVIOUS_URL_KEY]: url });
}

function sendUrlToTauri(url) {
  const message = {
    type: "URL_CHANGE",
    url,
    timestamp: Date.now(),
  };

  chrome.runtime.sendNativeMessage(NATIVE_HOST, message, (response) => {
    if (chrome.runtime.lastError) {
      console.warn(
        "Native Messaging エラー (Mock データで処理):",
        chrome.runtime.lastError.message,
      );
      handleMockResponse(url);
      return;
    }

    console.log("Tauri からの応答:", response);
  });
}

function handleMockResponse(url) {
  console.log("[Mock] Tauri シミュレーション応答:", {
    success: true,
    message: "Mock データで処理されました",
    url,
    timestamp: Date.now(),
  });
}

async function processUrl(candidateUrl, reason) {
  const previousUrl = await getPreviousActiveUrl();
  const nextUrl = getNextTrackedUrl(previousUrl, candidateUrl);

  if (!nextUrl) {
    return;
  }

  await setPreviousActiveUrl(nextUrl);
  console.log(`${reason}:`, nextUrl);
  sendUrlToTauri(nextUrl);
}

async function processTab(tab, reason) {
  if (!tab?.active || !tab.url || typeof tab.windowId !== "number") {
    return;
  }

  try {
    const window = await chrome.windows.get(tab.windowId);
    if (!window.focused) {
      return;
    }

    await processUrl(tab.url, reason);
  } catch (error) {
    console.error("タブ情報の処理に失敗:", error);
  }
}

async function getActiveTab(windowId) {
  const query = { active: true };

  if (typeof windowId === "number") {
    query.windowId = windowId;
  } else {
    query.lastFocusedWindow = true;
  }

  const [activeTab] = await chrome.tabs.query(query);
  return activeTab ?? null;
}

function startMonitoring() {
  if (isMonitoring) {
    return;
  }

  isMonitoring = true;
  console.log("Web Tracker 監視を開始");

  getActiveTab()
    .then((tab) => processTab(tab, "初期URL検出"))
    .catch((error) => console.error("初期URLの取得に失敗:", error));

  chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs
      .get(tabId)
      .then((tab) => processTab(tab, "タブ切り替わり検出"))
      .catch((error) => console.error("切り替え先タブの取得に失敗:", error));
  });

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active) {
      processTab({ ...tab, url: changeInfo.url }, "URL更新検出");
    }
  });

  chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      return;
    }

    getActiveTab(windowId)
      .then((tab) => processTab(tab, "ウィンドウ切り替わり検出"))
      .catch((error) => console.error("アクティブウィンドウの取得に失敗:", error));
  });
}

startMonitoring();

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action !== "getStatus") {
    return false;
  }

  getPreviousActiveUrl()
    .then((currentUrl) => sendResponse({ isMonitoring, currentUrl }))
    .catch((error) => {
      console.error("監視状態の取得に失敗:", error);
      sendResponse({ isMonitoring: false, currentUrl: null });
    });

  return true;
});
