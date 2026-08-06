import { useEffect, useRef, type ComponentType } from "react";

import { RESULT_FLOW_STEPS } from "../../constants/resultFlow";
import { useResultFlowStore } from "../../stores/useResultFlowStore";
import { RESULT_FLOW_PREVIEW_CONTENT } from "../../test/fixtures/resultFlowPreview";
import type { ResultFlowStep } from "../../types/resultFlow";
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
};

export function ResultFlow({ onExit }: ResultFlowProps) {
  const status = useResultFlowStore((state) => state.status);
  const mode = useResultFlowStore((state) => state.mode);
  const currentStep = useResultFlowStore((state) => state.currentStep);
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

  useEffect(() => {
    if (status !== "completed" || hasExited.current) return;

    hasExited.current = true;
    onExit();
  }, [onExit, status]);

  if (status === "idle" || mode !== "preview") return null;

  const currentIndex = RESULT_FLOW_STEPS.indexOf(currentStep);
  const isLastStep = currentIndex === RESULT_FLOW_STEPS.length - 1;
  const StepComponent = STEP_COMPONENTS[currentStep];

  return (
    <main className="result-flow">
      <div className="result-flow__surface">
        <p className="result-flow__eyebrow">開発用プレビュー</p>
        <ResultProgress currentStep={currentStep} />
        <StepComponent
          content={RESULT_FLOW_PREVIEW_CONTENT[currentStep]}
          status={stepStatus}
          animationSkipped={animationSkipped}
        />
        <ResultFlowControls
          canPrevious={currentIndex > 0}
          isLastStep={isLastStep}
          animationSkipped={animationSkipped}
          onPrevious={previous}
          onNext={isLastStep ? finish : next}
          onSkipAnimation={skipAnimation}
          onSkipAll={skipAll}
        />
      </div>
    </main>
  );
}
