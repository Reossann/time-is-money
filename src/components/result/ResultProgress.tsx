import {
  RESULT_FLOW_STEPS,
  RESULT_FLOW_STEP_COUNT,
} from "../../constants/resultFlow";
import { RESULT_FLOW_PREVIEW_CONTENT } from "../../test/fixtures/resultFlowPreview";
import type { ResultFlowStep } from "../../types/resultFlow";

type ResultProgressProps = {
  currentStep: ResultFlowStep;
};

export function ResultProgress({ currentStep }: ResultProgressProps) {
  const currentIndex = RESULT_FLOW_STEPS.indexOf(currentStep);

  return (
    <div className="result-progress">
      <p className="result-progress__summary" aria-live="polite">
        ステップ {currentIndex + 1} / {RESULT_FLOW_STEP_COUNT}
      </p>
      <ol className="result-progress__list" aria-label="結果フローの進捗">
        {RESULT_FLOW_STEPS.map((step, index) => (
          <li
            key={step}
            className={
              step === currentStep
                ? "result-progress__item result-progress__item--current"
                : index < currentIndex
                  ? "result-progress__item result-progress__item--complete"
                  : "result-progress__item"
            }
            aria-current={step === currentStep ? "step" : undefined}
          >
            <span className="result-progress__number" aria-hidden="true">
              {index + 1}
            </span>
            <span>{RESULT_FLOW_PREVIEW_CONTENT[step].title}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
