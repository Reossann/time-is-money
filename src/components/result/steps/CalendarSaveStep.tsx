import { useSessionRecordPersistence } from "../../../hooks/useSessionRecordPersistence";
import { CalendarSavePanel } from "./CalendarSavePanel";
import { CalendarPreview } from "./CalendarPreview";
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
function CalendarSaveConnectedStep({ content }: ResultStepProps) {
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
      ) : null}
    </section>
  );
}

export function CalendarSaveStep(props: ResultStepProps) {
  if (props.status === "ready") {
    return <CalendarSaveConnectedStep {...props} />;
  }
  return <ResultStepPlaceholder step="calendar-save" {...props} />;
}
