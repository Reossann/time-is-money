import { useState } from "react";
import { useActivityStore } from "../stores/useActivityStore";
import { formatTime } from "../services/activityService";

export function DashboardPage() {
  const { elapsedSeconds, isRunning } = useActivityStore();
  const [error, setError] = useState<string | null>(null);

  // 状態の検証
  if (elapsedSeconds === undefined || isRunning === undefined) {
    const errorMsg =
      "エラー: 計測状態の取得に失敗しました。アプリを再起動してください。";
    return (
      <main className="page">
        <h2>Dashboard</h2>
        <div className="error-section" style={{ color: "red" }}>
          <p>⚠️ {errorMsg}</p>
        </div>
      </main>
    );
  }

  // formatTime の実行時エラーをキャッチ
  let formattedTime: string;
  try {
    formattedTime = formatTime(elapsedSeconds);
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "時間のフォーマットに失敗しました。";
    setError(errorMsg);
    return (
      <main className="page">
        <h2>Dashboard</h2>
        <div className="error-section" style={{ color: "red" }}>
          <p>⚠️ {errorMsg}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <h2>Dashboard</h2>

      {error && (
        <div className="error-section" style={{ color: "red", marginBottom: "20px" }}>
          <p>⚠️ {error}</p>
        </div>
      )}

      <div className="timer-section">
        <div className="timer-display">{formattedTime}</div>
        <p>計測状況: {isRunning ? "計測中 ▶" : "停止中 ⏸"}</p>
      </div>

      <p>現在のアプリ利用状況を表示する予定の画面です。</p>
    </main>
  );
}
