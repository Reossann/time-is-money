import { useSessionRecordPersistence } from "../../../hooks/useSessionRecordPersistence";
import { CalendarSavePanel } from "./CalendarSavePanel";
import { CalendarPreview } from "./CalendarPreview";
import type { SessionRecord } from "../../../types/sessionRecord";
import {
  ResultStepPlaceholder,
  type ResultStepProps,
} from "./ResultStepPlaceholder";

const HEADING_ID = "result-step-calendar-save";

/**
 * Live calendar-save step. Mounting it triggers the one-time persistence and
 * renders the save state with retry/undo controls. Rendered only when the step
 * is connected (status "ready"); the dev preview keeps using the placeholder so
 * it never writes real records.
 */
function CalendarSaveConnectedStep({ content, previewRecord }: CalendarSaveStepProps) {
  const { status, errorCode, retry, remove, savedRecord } = useSessionRecordPersistence();

  return (
    <section className="result-step" aria-labelledby={HEADING_ID}>
      <h1 id={HEADING_ID} className="result-step__title" tabIndex={-1}>
        {content.title}
      </h1>
      <p className="result-step__description">{content.description}</p>
      <CalendarSavePanel
        status={status}
        errorCode={errorCode}
        onRetry={retry}
        onUndo={remove}
      />
      {status === "saved" && savedRecord !== null ? (
        <CalendarPreview record={savedRecord} />
      ) : previewRecord !== undefined ? (
        <CalendarPreview record={previewRecord} />
      ) : null}
    </section>
  );
}

export type CalendarSaveStepProps = ResultStepProps & {
  previewRecord?: SessionRecord;
  previewRecords?: ReadonlyArray<SessionRecord>;
};

export function CalendarSaveStep(props: CalendarSaveStepProps) {
  if (props.previewRecord !== undefined) {
    return (
      <section className="result-step" aria-labelledby={HEADING_ID}>
        <p className="result-step__status">開発用データ</p>
        <h1 id={HEADING_ID} className="result-step__title" tabIndex={-1}>
          {props.content.title}
        </h1>
        <p className="result-step__description">{props.content.description}</p>
        <p className="result-step__issue">担当: {props.content.responsibleIssue}</p>
        <p className="result-step__notice">
          これは開発用プレビューです。実際の保存処理は行っていません。
        </p>
        <p className="calendar-save__status calendar-save__status--saved" role="status">
          <span className="calendar-save__check" aria-hidden="true">✓</span>
          <span>計測結果をカレンダーへ保存しました。</span>
        </p>
        <CalendarPreview
          record={props.previewRecord}
          records={props.previewRecords}
          currentDateKey="2026-08-16"
        />
      </section>
    );
  }

  if (props.status === "ready") {
    return <CalendarSaveConnectedStep {...props} />;
  }
  return <ResultStepPlaceholder step="calendar-save" {...props} />;
}
