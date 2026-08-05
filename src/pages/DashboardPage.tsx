import { useActivityStore } from "../stores/useActivityStore";
import { useWebAppStore } from "../stores/useWebAppStore";
import { formatTime } from "../services/activityService";
import { formatSessionDuration } from "../services/webAppService";

export function DashboardPage() {
  const elapsedSeconds = useActivityStore((state) => state.elapsedSeconds);
  const usageStats = useWebAppStore((state) => state.usageStats);

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

      <section className="timer-section">
        <h3>PCを開いている時間</h3>
        <div className="timer-display">{formattedTime}</div>
        <p>計測状況: 計測中 ▶</p>
        <p>アプリを開いてからの利用時間を表示しています。</p>
      </section>

      <section className="web-apps-section">
        <h3>ウェブアプリ別利用時間</h3>
        {usageStats.length === 0 ? (
          <p>ウェブアプリの使用が検出されていません。</p>
        ) : (
          <ul className="webapp-list">
            {usageStats.map((stat) => (
              <li key={stat.webAppId} className="webapp-item">
                <div className="webapp-name">{stat.webAppName}</div>
                <div className="webapp-duration">
                  {formatSessionDuration(stat.cumulativeSeconds)}
                </div>
                <div className="webapp-session-count">
                  セッション数: {stat.sessionCount}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
