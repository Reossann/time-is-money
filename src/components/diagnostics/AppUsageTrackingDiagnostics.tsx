import { useEffect } from "react";

import {
  refreshAppUsageTrackingSnapshot,
  useMeasurementTrackingState,
} from "../../hooks/useMeasurementTracking";

const statusLabels = {
  idle: "待機中",
  starting: "開始中",
  tracking: "計測中",
  stopping: "停止中",
  stopped: "停止済み",
  "start-failed": "開始失敗",
  "stop-failed": "停止失敗",
} as const;

export function AppUsageTrackingDiagnostics() {
  const { status, snapshot, errorCode } = useMeasurementTrackingState();

  useEffect(() => {
    if (status !== "tracking") return;

    const refresh = () => {
      void refreshAppUsageTrackingSnapshot().catch(() => undefined);
    };

    refresh();
    const intervalId = window.setInterval(refresh, 1_000);
    return () => window.clearInterval(intervalId);
  }, [status]);

  return (
    <section
      className="app-usage-diagnostics"
      aria-label="Windowsアプリ利用時間の開発診断"
    >
      <p className="app-usage-diagnostics__label">Development only</p>
      <h3>Windowsアプリ利用時間</h3>
      <dl className="app-usage-diagnostics__summary">
        <div>
          <dt>追跡状態</dt>
          <dd>{statusLabels[status]}</dd>
        </div>
        <div>
          <dt>追跡済み</dt>
          <dd>{snapshot?.trackedDurationSeconds ?? 0}秒</dd>
        </div>
        <div>
          <dt>未追跡</dt>
          <dd>{snapshot?.untrackedDurationSeconds ?? 0}秒</dd>
        </div>
      </dl>

      {errorCode ? (
        <p className="app-usage-diagnostics__error" role="alert">
          エラーコード: {errorCode}
        </p>
      ) : null}

      {snapshot && snapshot.apps.length > 0 ? (
        <ul className="app-usage-diagnostics__apps">
          {snapshot.apps.map((app) => (
            <li key={app.appId}>
              <span>{app.processName}</span>
              <strong>{app.durationSeconds}秒</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p>計測済みのWindowsアプリはまだありません。</p>
      )}

      <p className="app-usage-diagnostics__note">
        この表示用更新を閉じても、Rust側の計測は継続します。
      </p>
    </section>
  );
}
