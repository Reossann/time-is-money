import { useEffect, useRef, useState, type ComponentType } from "react";

import { RESULT_FLOW_STEPS } from "../../constants/resultFlow";
import { useResultFlowStore } from "../../stores/useResultFlowStore";
import { saveFinalizedSessionRecordOnce } from "../../services/sessionRecordPersistenceController";
import { RESULT_FLOW_PREVIEW_CONTENT } from "../../test/fixtures/resultFlowPreview";
import type { ResultFlowStep } from "../../types/resultFlow";
import type { SessionResult } from "../../types/sessionResult";
import { ResultFlowControls } from "./ResultFlowControls";
import { ResultProgress } from "./ResultProgress";
import { AppBreakdownStep } from "./steps/AppBreakdownStep";
import { CalendarSaveStep } from "./steps/CalendarSaveStep";
import { FinalizingStep } from "./steps/FinalizingStep";
import { HouseEquivalentStep } from "./steps/HouseEquivalentStep";
import { ImprovementStep } from "./steps/ImprovementStep";
import { LifetimeMoneyStep } from "./steps/LifetimeMoneyStep";
import { ReturningHomeStep } from "./steps/ReturningHomeStep";
import { SessionMoneyStep } from "./steps/SessionMoneyStep";
import type { ResultStepProps } from "./steps/ResultStepPlaceholder";

const STEP_COMPONENTS: Readonly<
  Record<ResultFlowStep, ComponentType<ResultStepProps>>
> = {
  finalizing: FinalizingStep,
  "app-breakdown": AppBreakdownStep,
  "session-money": SessionMoneyStep,
  "lifetime-money": LifetimeMoneyStep,
  "house-equivalent": HouseEquivalentStep,
  "calendar-save": CalendarSaveStep,
  improvement: ImprovementStep,
  "returning-home": ReturningHomeStep,
};

type ResultFlowProps = {
  onExit: () => void;
  result?: SessionResult;
  saveFinalizedSession?: () => Promise<unknown>;
};

export function ResultFlow({
  onExit,
  result,
  saveFinalizedSession = saveFinalizedSessionRecordOnce,
}: ResultFlowProps) {
  const status = useResultFlowStore((state) => state.status);
  const mode = useResultFlowStore((state) => state.mode);
  const currentStep = useResultFlowStore((state) => state.currentStep);
  const transitionDirection = useResultFlowStore(
    (state) => state.transitionDirection,
  );
  const stepStatus = useResultFlowStore(
    (state) => state.stepStatuses[state.currentStep],
  );
  const animationSkipped = useResultFlowStore((state) =>
    state.skippedAnimations.includes(state.currentStep),
  );
  const next = useResultFlowStore((state) => state.next);
  const previous = useResultFlowStore((state) => state.previous);
  const skipAnimation = useResultFlowStore((state) => state.skipAnimation);
  const skipAll = useResultFlowStore((state) => state.skipAll);
  const finish = useResultFlowStore((state) => state.finish);
  const hasExited = useRef(false);
  const [isSkipAllSaving, setIsSkipAllSaving] = useState(false);
  const [skipAllSaveFailed, setSkipAllSaveFailed] = useState(false);

  useEffect(() => {
    if (status !== "completed" || hasExited.current) return;

    hasExited.current = true;
    onExit();
  }, [onExit, status]);

  if (status === "idle" || mode === null) return null;
  if (mode === "live" && result === undefined) return null;

  const currentIndex = RESULT_FLOW_STEPS.indexOf(currentStep);
  const isLastStep = currentIndex === RESULT_FLOW_STEPS.length - 1;
  const StepComponent = STEP_COMPONENTS[currentStep];
  const skipAllWithPersistence = () => {
    if (mode !== "live") {
      skipAll();
      return;
    }
    if (isSkipAllSaving) return;

    setIsSkipAllSaving(true);
    setSkipAllSaveFailed(false);
    void saveFinalizedSession().then(
      () => skipAll(),
      () => {
        setIsSkipAllSaving(false);
        setSkipAllSaveFailed(true);
      },
    );
  };

  return (
    <main className="result-flow">
      <div className="result-flow__surface">
        <p className="result-flow__eyebrow">
          {mode === "preview" ? "開発用プレビュー" : "今回の結果"}
        </p>
        <ResultProgress currentStep={currentStep} />
        <div
          key={currentStep}
          className={`result-step-transition result-step-transition--${transitionDirection}`}
          data-testid="result-step-transition"
        >
          <StepComponent
            content={RESULT_FLOW_PREVIEW_CONTENT[currentStep]}
            status={stepStatus}
            animationSkipped={animationSkipped}
            result={result}
          />
        </div>
        <ResultFlowControls
          canPrevious={currentIndex > 0}
          isLastStep={isLastStep}
          animationSkipped={animationSkipped}
          isSkippingAll={isSkipAllSaving}
          onPrevious={previous}
          onNext={isLastStep ? finish : next}
          onSkipAnimation={skipAnimation}
          onSkipAll={skipAllWithPersistence}
        />
        {skipAllSaveFailed ? (
          <div className="calendar-save">
            <p className="calendar-save__error" role="alert">
              保存できなかったため、結果を終了していません。
            </p>
            <button
              className="calendar-save__retry"
              onClick={skipAllWithPersistence}
              type="button"
            >
              保存して終了を再試行
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
