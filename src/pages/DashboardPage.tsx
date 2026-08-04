import { useActivityStore } from "../stores/useActivityStore";
import { formatTime } from "../services/activityService";

export function DashboardPage() {
  const { elapsedSeconds, isRunning } = useActivityStore();

  const formattedTime = formatTime(elapsedSeconds);

  return (
    <main className="page">
      <h2>Dashboard</h2>

      <div className="timer-section">
        <div className="timer-display">{formattedTime}</div>
        <p>計測状況: {isRunning ? "計測中 ▶" : "停止中 ⏸"}</p>
      </div>

      <p>現在のアプリ利用状況を表示する予定の画面です。</p>
    </main>
  );
}
