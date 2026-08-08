import { getNextTrackedUrl, sanitizeTrackedUrl } from "./tracking-utils.js";
import {
  connectionStateForError,
  nativeConnectionState,
  sendNativeMessage,
} from "./native-messaging/client.js";
import { createDeliveryQueue } from "./native-messaging/delivery-queue.js";

const NATIVE_HOST = "com.timeismoney.app";
const PREVIOUS_URL_KEY = "previousActiveUrl";
const CONNECTION_STATE_KEY = "nativeConnectionState";
const SYNC_ALARM = "native-connection-sync";

let isMonitoring = false;
const deliveryQueue = createDeliveryQueue();
let lastConnectionRetryAt = 0;

async function getPreviousActiveUrl() {
  const stored = await chrome.storage.session.get(PREVIOUS_URL_KEY);
  return stored[PREVIOUS_URL_KEY] ?? null;
}

async function setPreviousActiveUrl(url) {
  await chrome.storage.session.set({ [PREVIOUS_URL_KEY]: url });
}

async function getConnectionState() {
  const stored = await chrome.storage.session.get(CONNECTION_STATE_KEY);
  return stored[CONNECTION_STATE_KEY] ?? nativeConnectionState.monitoring;
}

async function setConnectionState(state) {
  await chrome.storage.session.set({ [CONNECTION_STATE_KEY]: state });
}

async function deliverMessage(message) {
  try {
    const response = await sendNativeMessage(chrome.runtime, NATIVE_HOST, message);
    await setConnectionState(nativeConnectionState.connected);
    return response;
  } catch (error) {
    await setConnectionState(connectionStateForError(error));
    console.warn("Native Messaging送信失敗:", error);
    throw error;
  }
}

async function processUrlNow(candidateUrl, reason, force = false) {
  const previousUrl = await getPreviousActiveUrl();
  const nextUrl = force
    ? sanitizeTrackedUrl(candidateUrl)
    : getNextTrackedUrl(previousUrl, candidateUrl);

  if (!nextUrl) {
    if (previousUrl && sanitizeTrackedUrl(candidateUrl) === null) {
      await stopTrackingNow("計測対象外URL検出");
    }
    return;
  }

  console.log(`${reason}:`, nextUrl);

  await deliverMessage({
    type: "URL_CHANGE",
    url: nextUrl,
    timestamp: Date.now(),
  });
  await setPreviousActiveUrl(nextUrl);
}

async function stopTrackingNow(reason) {
  console.log(`${reason}: 計測停止を通知`);

  await deliverMessage({
    type: "TRACKING_STOP",
    timestamp: Date.now(),
  });
  await setPreviousActiveUrl(null);
}

function processUrl(candidateUrl, reason, force = false) {
  return deliveryQueue.enqueue(() => processUrlNow(candidateUrl, reason, force));
}

function stopTracking(reason) {
  return deliveryQueue.enqueue(() => stopTrackingNow(reason));
}

async function processTab(tab, reason, force = false) {
  if (!tab?.active || !tab.url || typeof tab.windowId !== "number") {
    return;
  }

  try {
    const window = await chrome.windows.get(tab.windowId);
    if (!window.focused) {
      return;
    }

    await processUrl(tab.url, reason, force);
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

function retryActiveTabIfNeeded(connectionState) {
  const now = Date.now();
  if (
    connectionState === nativeConnectionState.connected ||
    deliveryQueue.pendingCount > 0 ||
    now - lastConnectionRetryAt < 5_000
  ) {
    return;
  }

  lastConnectionRetryAt = now;
  getActiveTab()
    .then((tab) => processTab(tab, "接続再試行", true))
    .catch((error) => console.error("接続再試行に失敗:", error));
}

function startMonitoring() {
  if (isMonitoring) {
    return;
  }

  isMonitoring = true;
  void setConnectionState(nativeConnectionState.monitoring);
  console.log("Web Tracker 監視を開始");

  getActiveTab()
    .then((tab) => processTab(tab, "初期URL検出", true))
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
      stopTracking("Chrome非アクティブ").catch(() => {});
      return;
    }

    getActiveTab(windowId)
      .then((tab) => processTab(tab, "ウィンドウ切り替わり検出", true))
      .catch((error) => console.error("アクティブウィンドウの取得に失敗:", error));
  });

  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 0.5 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== SYNC_ALARM) {
      return;
    }

    getActiveTab()
      .then((tab) => processTab(tab, "定期接続同期", true))
      .catch((error) => console.error("定期接続同期に失敗:", error));
  });
}

startMonitoring();

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action !== "getStatus") {
    return false;
  }

  Promise.all([getPreviousActiveUrl(), getConnectionState()])
    .then(([currentUrl, connectionState]) => {
      sendResponse({ isMonitoring, currentUrl, connectionState });
      retryActiveTabIfNeeded(connectionState);
    })
    .catch((error) => {
      console.error("監視状態の取得に失敗:", error);
      sendResponse({
        isMonitoring: false,
        currentUrl: null,
        connectionState: nativeConnectionState.sendFailed,
      });
    });

  return true;
});
