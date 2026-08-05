import { useActivityStore } from "../stores/useActivityStore";
import { formatTime } from "../services/activityService";

export function DashboardPage() {
  const elapsedSeconds = useActivityStore((state) => state.elapsedSeconds);

  let formattedTime: string;
  try {
    formattedTime = formatTime(elapsedSeconds);
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "時間のフォーマットに失敗しました。";
    return (
      <main className="page">
        <h2>Dashboard</h2>
        <div className="error-section" role="alert" style={{ color: "red" }}>
          <p>⚠️ {errorMsg}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <h2>Dashboard</h2>

      <div className="timer-section">
        <div className="timer-display">{formattedTime}</div>
        <p>計測状況: 計測中 ▶</p>
      </div>

      <p>アプリを開いてからの利用時間を表示しています。</p>
    </main>
  );
}
