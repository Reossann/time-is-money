import { useActivityStore } from "../stores/useActivityStore";
import { useWebAppStore } from "../stores/useWebAppStore";
import { formatTime } from "../services/activityService";
import { formatSessionDuration } from "../services/webAppService";

type DashboardPageProps = {
  onPreviewResultFlow?: () => void;
};

export function DashboardPage({ onPreviewResultFlow }: DashboardPageProps) {
  const elapsedSeconds = useActivityStore((state) => state.elapsedSeconds);
  const currentSession = useWebAppStore((state) => state.currentSession);
  const usageStats = useWebAppStore((state) => state.usageStats);

  const currentSessionStartedAt = currentSession?.endedAt ?? null
    ? null
    : currentSession?.startedAt ?? null;

  const currentSessionStartedLabel = currentSessionStartedAt
    ? new Intl.DateTimeFormat("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(currentSessionStartedAt)
    : null;

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

      <section className="current-webapp-section">
        <h3>現在のウェブアプリ</h3>
        {currentSession && currentSession.endedAt === null ? (
          <div className="current-webapp-card">
            <div className="webapp-name">{currentSession.webAppName}</div>
            <div className="current-webapp-meta">
              <span>セッション計測中</span>
              {currentSessionStartedLabel && (
                <span>開始: {currentSessionStartedLabel}</span>
              )}
            </div>
          </div>
        ) : (
          <p>まだ現在のウェブアプリは検出されていません。</p>
        )}
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

      {import.meta.env.DEV && onPreviewResultFlow ? (
        <section className="result-preview-entry" aria-label="開発用機能">
          <p className="result-preview-entry__label">Development only</p>
          <h3>結果フローの骨組み</h3>
          <p>
            実データを使わず、タイマー停止後の8段階と操作だけを確認します。
          </p>
          <button type="button" onClick={onPreviewResultFlow}>
            結果フローをプレビュー
          </button>
        </section>
      ) : null}
    </main>
  );
}
