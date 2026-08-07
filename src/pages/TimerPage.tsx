import { useEffect, useState } from "react";

import { useActivityStore } from "../stores/useActivityStore";
import { useWebAppStore } from "../stores/useWebAppStore";
import { formatTime } from "../services/activityService";
import { formatSessionDuration } from "../services/webAppService";
import { AppUsageTrackingDiagnostics } from "../components/diagnostics/AppUsageTrackingDiagnostics";

type TimerPageProps = {
  onPreviewResultFlow?: () => void;
};

function getActiveSessionSeconds(startedAt: number, now: number): number {
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

export function TimerPage({ onPreviewResultFlow }: TimerPageProps) {
  const elapsedSeconds = useActivityStore((state) => state.elapsedSeconds);
  const currentSession = useWebAppStore((state) => state.currentSession);
  const usageStats = useWebAppStore((state) => state.usageStats);
  const nativeBridgeStatus = useWebAppStore(
    (state) => state.nativeBridgeStatus,
  );

  const activeSession =
    currentSession?.endedAt === null ? currentSession : null;
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    if (!activeSession) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1_000);

    return () => window.clearInterval(intervalId);
  }, [activeSession]);

  const activeSessionSeconds = activeSession
    ? getActiveSessionSeconds(activeSession.startedAt, currentTime)
    : 0;
  const currentSessionStartedLabel = activeSession
    ? new Intl.DateTimeFormat("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(activeSession.startedAt)
    : null;

  let formattedTime: string;
  try {
    if (typeof elapsedSeconds !== "number" || elapsedSeconds < 0) {
      throw new Error("入力値は 0 以上である必要があります");
    }
    formattedTime = formatTime(elapsedSeconds);
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "時間のフォーマットに失敗しました。";
    return (
      <main className="page">
        <h2>タイマー</h2>
        <div className="error-section" role="alert" style={{ color: "red" }}>
          <p>⚠️ {errorMsg}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <h2>タイマー</h2>

      <section className="timer-section">
        <h3>PCを開いている時間</h3>
        <div className="timer-display">{formattedTime}</div>
        <p>計測状況: 計測中 ▶</p>
        <p>アプリを開いてからの利用時間を表示しています。</p>
      </section>

      <section className="current-webapp-section">
        <h3>Chrome拡張機能との接続</h3>
        <p>
          {nativeBridgeStatus === "connected"
            ? "接続済み"
            : nativeBridgeStatus === "invalid-event"
              ? "受信データを確認できませんでした"
              : "接続待機中"}
        </p>
      </section>

      <section className="current-webapp-section">
        <h3>現在のChromeサイト</h3>
        {activeSession ? (
          <div className="current-webapp-card">
            <div className="webapp-name">{activeSession.webAppName}</div>
            <div className="current-webapp-meta">
              <span>セッション計測中</span>
              {currentSessionStartedLabel && (
                <span>開始: {currentSessionStartedLabel}</span>
              )}
              <span>{formatSessionDuration(activeSessionSeconds)}</span>
            </div>
          </div>
        ) : (
          <p>現在、Chromeで計測対象のサイトは検出されていません。</p>
        )}
      </section>

      <section className="web-apps-section">
        <h3>Chromeサイト別利用時間</h3>
        {!Array.isArray(usageStats) || usageStats.length === 0 ? (
          <p>Chromeサイトの使用が検出されていません。</p>
        ) : (
          <ul className="webapp-list">
            {usageStats.map((stat) => {
              const displayedSeconds =
                stat.cumulativeSeconds +
                (activeSession?.webAppId === stat.webAppId
                  ? activeSessionSeconds
                  : 0);

              return (
                <li key={stat.webAppId} className="webapp-item">
                  <div className="webapp-name">{stat.webAppName}</div>
                  <div className="webapp-duration">
                    {formatSessionDuration(displayedSeconds)}
                  </div>
                  <div className="webapp-session-count">
                    セッション数: {stat.sessionCount}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {import.meta.env.DEV ? <AppUsageTrackingDiagnostics /> : null}

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
