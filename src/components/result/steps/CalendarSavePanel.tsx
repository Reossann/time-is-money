import type {
  SessionRecordSaveErrorCode,
  SessionRecordSaveStatus,
} from "../../../types/sessionRecord";

const STATUS_MESSAGES: Record<SessionRecordSaveStatus, string> = {
  idle: "保存の準備をしています。",
  saving: "計測結果を保存しています…",
  saved: "計測結果をカレンダーへ保存しました。",
  failed: "計測結果を保存できませんでした。",
};

const ERROR_MESSAGES: Record<SessionRecordSaveErrorCode, string> = {
  NOT_FINALIZED: "保存できる計測結果がまだありません。",
  OWNER_UNRESOLVED: "保存先アカウントを特定できませんでした。",
  INVALID_RECORD: "計測結果を保存用に整えられませんでした。",
  SAVE_FAILED: "保存に失敗しました。もう一度お試しください。",
};

export type CalendarSavePanelProps = {
  status: SessionRecordSaveStatus;
  errorCode: SessionRecordSaveErrorCode | null;
  onRetry: () => void;
  onUndo: () => void;
};

/**
 * Presentational save panel for the calendar-save step. It renders only the
 * save state and the retry/undo controls; all persistence logic lives in the
 * controller and hook so this stays trivially testable.
 */
export function CalendarSavePanel({
  status,
  errorCode,
  onRetry,
  onUndo,
}: CalendarSavePanelProps) {
  return (
    <div className="calendar-save">
      {status === "saved" ? (
        <p className="calendar-save__status calendar-save__status--saved" role="status">
          <span className="calendar-save__check" aria-hidden="true">✓</span>
          <span>{STATUS_MESSAGES[status]}</span>
        </p>
      ) : (
        <p className="calendar-save__status" role="status">
          {STATUS_MESSAGES[status]}
        </p>
      )}
      {status === "failed" ? (
        <>
          <p className="calendar-save__error">
            {errorCode !== null
              ? ERROR_MESSAGES[errorCode]
              : STATUS_MESSAGES.failed}
          </p>
          <button
            type="button"
            className="calendar-save__retry"
            onClick={onRetry}
          >
            もう一度保存する
          </button>
        </>
      ) : null}
      {status === "saved" ? (
        <button
          type="button"
          className="calendar-save__undo"
          onClick={onUndo}
        >
          この記録を取り消す
        </button>
      ) : null}
    </div>
  );
}
