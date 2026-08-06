type ResultFlowControlsProps = {
  canPrevious: boolean;
  isLastStep: boolean;
  animationSkipped: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSkipAnimation: () => void;
  onSkipAll: () => void;
};

export function ResultFlowControls({
  canPrevious,
  isLastStep,
  animationSkipped,
  onPrevious,
  onNext,
  onSkipAnimation,
  onSkipAll,
}: ResultFlowControlsProps) {
  const runSingleClick = (
    event: MouseEvent<HTMLButtonElement>,
    action: () => void,
  ) => {
    if (event.detail > 1) return;
    action();
  };

  return (
    <div
      className="result-flow-controls"
      role="group"
      aria-label="結果フローの操作"
    >
      <button
        type="button"
        className="result-flow-button result-flow-button--secondary"
        onClick={(event) => runSingleClick(event, onPrevious)}
        disabled={!canPrevious}
      >
        戻る
      </button>
      <button
        type="button"
        className="result-flow-button result-flow-button--secondary"
        onClick={(event) => runSingleClick(event, onSkipAnimation)}
        disabled={animationSkipped}
      >
        {animationSkipped ? "演出スキップ済み" : "この演出をスキップ"}
      </button>
      <button
        type="button"
        className="result-flow-button result-flow-button--quiet"
        onClick={(event) => runSingleClick(event, onSkipAll)}
      >
        結果演出をすべてスキップ
      </button>
      <button
        type="button"
        className="result-flow-button result-flow-button--primary"
        onClick={(event) => runSingleClick(event, onNext)}
      >
        {isLastStep ? "プレビューを完了" : "次へ"}
      </button>
    </div>
  );
}
import type { MouseEvent } from "react";
