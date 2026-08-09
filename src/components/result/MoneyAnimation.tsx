import { useEffect, useRef, useState, type CSSProperties } from "react";

import { MONEY_ANIMATION_ENTRY_DELAY_MS } from "../../constants/moneyAnimation";
import { createMoneyAnimationDisplayModel } from "../../services/moneyAnimationService";
import type { MoneyAnimationProps } from "../../types/moneyAnimation";

const PARTICLE_DELAY_MILLISECONDS = 55;

export function MoneyAnimation({
  amountYen,
  mode,
  playState,
  runId,
}: MoneyAnimationProps) {
  const model = createMoneyAnimationDisplayModel({ amountYen, mode });
  const stageRef = useRef<HTMLDivElement>(null);
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
  const animationRequested = playState === "playing" && !model.isZero;
  const isAnimated = animationRequested && hasEnteredViewport;

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

  return (
    <section
      className={`money-animation money-animation--${model.mode}${
        model.isZero ? " money-animation--zero" : ""
      }${isAnimated ? " money-animation--playing" : ""}`}
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
