/**
 * Chrome拡張機能 - Popup UI
 * 計測状況だけを表示する。
 */

const statusElement = document.getElementById("status");

async function updateUI() {
  try {
    chrome.runtime.sendMessage({ action: "getStatus" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Backgroundとの通信エラー:", chrome.runtime.lastError);
        statusElement.textContent = "エラー: 通信に失敗しました";
        return;
      }

      const statusLabels = {
        connected: "✅ アプリ接続済み",
        monitoring: "🔄 計測確認中",
        "host-unregistered": "⚠️ Native Host未登録",
        "app-unavailable": "⚠️ Time Is Moneyが未起動",
        "send-failed": "⚠️ アプリへの送信失敗",
      };

      statusElement.textContent = response.isMonitoring
        ? (statusLabels[response.connectionState] ?? "🔄 計測確認中")
        : "⏸ 計測中止";
    });
  } catch (error) {
    console.error("UI更新エラー:", error);
    statusElement.textContent = "エラーが発生しました";
  }
}

updateUI();
setInterval(updateUI, 1000);
