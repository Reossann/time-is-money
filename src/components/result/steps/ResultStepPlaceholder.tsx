import type {
  ResultFlowPreviewContent,
  ResultFlowStep,
  ResultStepStatus,
} from "../../../types/resultFlow";

export type ResultStepProps = {
  content: ResultFlowPreviewContent;
  status: ResultStepStatus;
  animationSkipped: boolean;
};

type ResultStepPlaceholderProps = ResultStepProps & {
  step: ResultFlowStep;
};

export function ResultStepPlaceholder({
  step,
  content,
  status,
  animationSkipped,
}: ResultStepPlaceholderProps) {
  const headingId = `result-step-${step}`;

  return (
    <section className="result-step" aria-labelledby={headingId}>
      <p className="result-step__status">
        {status === "placeholder" ? "準備中" : "接続済み"}
      </p>
      <h1 id={headingId} className="result-step__title" tabIndex={-1}>
        {content.title}
      </h1>
      <p className="result-step__description">{content.description}</p>
      <p className="result-step__issue">担当: {content.responsibleIssue}</p>
      <p className="result-step__notice">
        これは開発用プレビューです。実際の金額・保存結果・設定変更は行いません。
      </p>
      {animationSkipped ? (
        <p className="result-step__skip-status" role="status">
          このステップの演出をスキップしました。表示内容は変わりません。
        </p>
      ) : null}
    </section>
  );
}
