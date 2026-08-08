import { useSessionFinalization } from "../../hooks/useSessionFinalization";

const statusLabels = {
  idle: "待機中",
  running: "計測中",
  stopped: "停止済み",
  finalizing: "確定中",
  finalized: "確定済み",
  failed: "確定失敗",
} as const;

const categoryLabels = {
  productive: "生産的",
  waste: "浪費",
  neutral: "中立",
} as const;

function formatYen(value: number): string {
  return `${value.toLocaleString("ja-JP")}円`;
}

/** Development-only controls for exercising the finalized session boundary. */
export function SessionFinalizationDiagnostics() {
  const {
    status,
    result,
    errorCode,
    stopAndFinalizeMeasurement,
    retrySessionFinalization,
  } = useSessionFinalization();

  const stop = () => {
    void stopAndFinalizeMeasurement().catch(() => undefined);
  };
  const retry = () => {
    void retrySessionFinalization().catch(() => undefined);
  };

  return (
    <section
      className="session-finalization-diagnostics"
      aria-label="セッション結果の開発用確認"
    >
      <p className="session-finalization-diagnostics__label">Development only</p>
      <h3>セッション結果の確認</h3>
      <dl className="session-finalization-diagnostics__summary">
        <div>
          <dt>状態</dt>
          <dd>{statusLabels[status]}</dd>
        </div>
        {result ? (
          <>
            <div>
              <dt>計測時間</dt>
              <dd>{result.durationSeconds}秒</dd>
            </div>
            <div>
              <dt>獲得</dt>
              <dd>{formatYen(result.totals.earnedYen)}</dd>
            </div>
            <div>
              <dt>浪費</dt>
              <dd>{formatYen(result.totals.wastedYen)}</dd>
            </div>
            <div>
              <dt>差額</dt>
              <dd>{formatYen(result.totals.netYen)}</dd>
            </div>
          </>
        ) : null}
      </dl>

      {errorCode ? (
        <p className="session-finalization-diagnostics__error" role="alert">
          エラーコード: {errorCode}
        </p>
      ) : null}

      {status === "running" ? (
        <button type="button" onClick={stop}>
          停止して結果を確定
        </button>
      ) : null}
      {status === "failed" ? (
        <button type="button" onClick={retry}>
          結果の確定を再試行
        </button>
      ) : null}

      {result && result.apps.length > 0 ? (
        <ul className="session-finalization-diagnostics__apps">
          {result.apps.map((app) => (
            <li key={app.appId}>
              <span>{app.processName}</span>
              <span>{app.durationSeconds}秒</span>
              <span>
                {app.category === null
                  ? "未分類"
                  : categoryLabels[app.category]}
              </span>
              <span>{formatYen(app.hourlyRateYen)}/時</span>
              <strong>{formatYen(app.money.netYen)}</strong>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="session-finalization-diagnostics__note">
        表示するのはアプリ名、時間、分類、時給、金額だけです。
      </p>
    </section>
  );
}
