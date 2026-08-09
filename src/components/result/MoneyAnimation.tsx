import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { MONEY_ANIMATION_ENTRY_DELAY_MS } from "../../constants/moneyAnimation";
import { MONEY_ANIMATION_DURATION_MS } from "../../constants/moneyAnimation";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { createMoneyAnimationDisplayModel } from "../../services/moneyAnimationService";
import type {
  MoneyAnimationCompleteReason,
  MoneyAnimationProps,
} from "../../types/moneyAnimation";

const PARTICLE_DELAY_MILLISECONDS = 10;

export function MoneyAnimation({
  amountYen,
  mode,
  playState,
  runId,
  onStart,
  onComplete,
}: MoneyAnimationProps) {
  const model = createMoneyAnimationDisplayModel({ amountYen, mode });
  const stageRef = useRef<HTMLDivElement>(null);
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
  const startedRunIds = useRef(new Set<string>());
  const completedRunIds = useRef(new Set<string>());
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  onStartRef.current = onStart;
  onCompleteRef.current = onComplete;
  const prefersReducedMotion = useReducedMotion();
  const animationRequested =
    playState === "playing" && !model.isZero && !prefersReducedMotion;
  const isAnimated = animationRequested && hasEnteredViewport;

  const complete = useCallback((reason: MoneyAnimationCompleteReason) => {
    if (completedRunIds.current.has(runId)) return;

    completedRunIds.current.add(runId);
    onCompleteRef.current?.(reason);
  }, [runId]);

  useEffect(() => {
    setHasEnteredViewport(false);
    if (!animationRequested) return;

    const stage = stageRef.current;
    if (!stage || typeof window.IntersectionObserver === "undefined") {
      setHasEnteredViewport(true);
      return;
    }

    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;

        setHasEnteredViewport(true);
        observer.disconnect();
      },
      { threshold: 0.45 },
    );
    observer.observe(stage);

    return () => observer.disconnect();
  }, [animationRequested, runId]);

  useEffect(() => {
    if (playState === "idle") return;

    if (playState === "skipped") {
      complete("skipped");
      return;
    }

    if (model.isZero) {
      complete("zero");
      return;
    }

    if (prefersReducedMotion) complete("reduced-motion");
  }, [complete, model.isZero, playState, prefersReducedMotion, runId]);

  useEffect(() => {
    if (!isAnimated || completedRunIds.current.has(runId)) return;

    if (!startedRunIds.current.has(runId)) {
      startedRunIds.current.add(runId);
      onStartRef.current?.();
    }

    const timer = window.setTimeout(
      () => complete("finished"),
      MONEY_ANIMATION_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [complete, isAnimated, runId]);

  return (
    <section
      className={`money-animation money-animation--${model.mode}${
        model.isZero ? " money-animation--zero" : ""
      }${isAnimated ? " money-animation--playing" : ""}${
        prefersReducedMotion ? " money-animation--reduced-motion" : ""
      }`}
      data-mode={model.mode}
      data-play-state={playState}
      aria-labelledby={`money-animation-${model.mode}-title`}
      style={
        {
          "--money-animation-entry-delay": `${MONEY_ANIMATION_ENTRY_DELAY_MS}ms`,
        } as CSSProperties
      }
    >
      <div className="money-animation__copy">
        <p className="money-animation__mode">{model.modeLabel}</p>
        <h2
          id={`money-animation-${model.mode}-title`}
          className="money-animation__title"
        >
          {model.amountLabel}
        </h2>
        <output className="money-animation__amount">{model.formattedAmount}</output>
        <p className="money-animation__description">{model.description}</p>
        {model.isZero ? (
          <p className="money-animation__zero-state">
            今回は0円です。動きはありません。
          </p>
        ) : null}
      </div>
      <div
        ref={stageRef}
        className="money-animation__stage"
        aria-hidden="true"
      >
        {Array.from({ length: model.particleCount }, (_, index) => (
          <span
            key={`${model.mode}-${index}`}
            className="money-animation__particle"
            data-testid="money-animation-particle"
            style={
              {
                "--money-particle-delay": `${index * PARTICLE_DELAY_MILLISECONDS}ms`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </section>
  );
}
