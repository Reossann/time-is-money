import { useEffect, useRef, type CSSProperties } from "react";

import { MAX_RENDERED_COMPLETED_HOUSES } from "../../constants/houseEquivalent";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import type {
  HouseConstructionStage,
  HouseEquivalent,
} from "../../types/houseEquivalent";

type HouseEquivalentAnimationProps = Readonly<{
  equivalent: HouseEquivalent;
  animationSkipped?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
}>;

type HouseIllustrationProps = Readonly<{
  stage: HouseConstructionStage;
  completed?: boolean;
  isAnimating: boolean;
  order: number;
  testId?: string;
}>;

export const HOUSE_EQUIVALENT_ANIMATION_DURATION_MS = 1_500;

const STAGE_LABELS: Readonly<Record<HouseConstructionStage, string>> = {
  foundation: "基礎",
  frame: "骨組み",
  walls: "壁",
  roof: "屋根",
  finishing: "仕上げ",
};

function formatYen(value: number) {
  return `${new Intl.NumberFormat("ja-JP").format(value)}円`;
}

function HouseIllustration({
  stage,
  completed = false,
  isAnimating,
  order,
  testId,
}: HouseIllustrationProps) {
  const visibleStage = completed ? "finishing" : stage;
  const hasFrame = visibleStage !== "foundation";
  const hasWalls =
    visibleStage === "walls" ||
    visibleStage === "roof" ||
    visibleStage === "finishing";
  const hasRoof = visibleStage === "roof" || visibleStage === "finishing";
  const hasFinishing = visibleStage === "finishing";

  return (
    <div
      aria-hidden="true"
      className={`house-equivalent-animation__house house-equivalent-animation__house--${visibleStage}${
        completed ? " house-equivalent-animation__house--completed" : ""
      }${isAnimating ? " house-equivalent-animation__house--animated" : ""}`}
      data-stage={visibleStage}
      data-testid={testId}
      style={{ "--house-animation-order": order } as CSSProperties}
    >
      <span className="house-equivalent-animation__foundation" />
      {hasFrame ? (
        <span className="house-equivalent-animation__frame">
          <span className="house-equivalent-animation__column house-equivalent-animation__column--left" />
          <span className="house-equivalent-animation__column house-equivalent-animation__column--right" />
          <span className="house-equivalent-animation__beam" />
        </span>
      ) : null}
      {hasWalls ? <span className="house-equivalent-animation__walls" /> : null}
      {hasRoof ? <span className="house-equivalent-animation__roof" /> : null}
      {hasFinishing ? (
        <span className="house-equivalent-animation__window" />
      ) : null}
    </div>
  );
}

export function HouseEquivalentAnimation({
  equivalent,
  animationSkipped = false,
  onComplete,
  onSkip,
}: HouseEquivalentAnimationProps) {
  const prefersReducedMotion = useReducedMotion();
  const renderedCompletedHouseCount = Math.min(
    equivalent.completedHouseCount,
    MAX_RENDERED_COMPLETED_HOUSES,
  );
  const additionalCompletedHouseCount =
    equivalent.completedHouseCount - renderedCompletedHouseCount;
  const completedHouses = Array.from(
    { length: renderedCompletedHouseCount },
    (_, index) => index,
  );
  const animationKey = [
    equivalent.earnedYen,
    equivalent.wastedYen,
    equivalent.completedHouseCount,
    equivalent.currentHouseProgressPercent,
    equivalent.constructionStage,
  ].join(":");
  const animationCanPlay =
    equivalent.earnedYen > 0 && !animationSkipped && !prefersReducedMotion;
  const completionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (completionKeyRef.current === animationKey) return undefined;

    if (animationSkipped) {
      completionKeyRef.current = animationKey;
      onSkip?.();
      return undefined;
    }

    if (!animationCanPlay) {
      completionKeyRef.current = animationKey;
      onComplete?.();
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      if (completionKeyRef.current === animationKey) return;

      completionKeyRef.current = animationKey;
      onComplete?.();
    }, HOUSE_EQUIVALENT_ANIMATION_DURATION_MS);

    return () => window.clearTimeout(timerId);
  }, [animationCanPlay, animationKey, animationSkipped, onComplete, onSkip]);

  return (
    <section
      aria-labelledby="house-equivalent-heading"
      className={`house-equivalent-animation${
        animationCanPlay ? " house-equivalent-animation--playing" : ""
      }${animationSkipped ? " house-equivalent-animation--skipped" : ""}${
        prefersReducedMotion
          ? " house-equivalent-animation--reduced-motion"
          : ""
      }`}
      data-animation-state={
        animationSkipped ? "skipped" : animationCanPlay ? "playing" : "static"
      }
      data-testid="house-equivalent-animation"
    >
      <header className="house-equivalent-animation__header">
        <p className="house-equivalent-animation__eyebrow">累計の成果</p>
        <h2 id="house-equivalent-heading">
          家{equivalent.completedHouseCount}軒と
          {equivalent.currentHouseProgressPercent}%分
        </h2>
        <p className="house-equivalent-animation__earned">
          累計獲得額: <strong>{formatYen(equivalent.earnedYen)}</strong>
        </p>
      </header>

      <div className="house-equivalent-animation__illustrations">
        <div
          aria-label={`完成した家 ${equivalent.completedHouseCount}軒`}
          className="house-equivalent-animation__completed-houses"
        >
          {completedHouses.map((index) => (
            <HouseIllustration
              completed
              isAnimating={animationCanPlay}
              key={index}
              order={index}
              stage="finishing"
              testId="house-equivalent-completed-house"
            />
          ))}
          {additionalCompletedHouseCount > 0 ? (
            <span
              className="house-equivalent-animation__additional-count"
              data-testid="house-equivalent-additional-count"
            >
              ほか{additionalCompletedHouseCount}軒
            </span>
          ) : null}
        </div>

        <div className="house-equivalent-animation__current-house">
          <HouseIllustration
            isAnimating={animationCanPlay}
            order={renderedCompletedHouseCount}
            stage={equivalent.constructionStage}
            testId="house-equivalent-current-house"
          />
          <p>
            建設中: {equivalent.currentHouseProgressPercent}%（
            {STAGE_LABELS[equivalent.constructionStage]}）
          </p>
        </div>
      </div>

      <dl className="house-equivalent-animation__summary">
        <div>
          <dt>完成した家</dt>
          <dd>{equivalent.completedHouseCount}軒</dd>
        </div>
        <div>
          <dt>次の1軒まで</dt>
          <dd>あと{formatYen(equivalent.remainingYenToNextHouse)}</dd>
        </div>
      </dl>

      {equivalent.earnedYen === 0 ? (
        <p className="house-equivalent-animation__guidance">
          まずは基礎づくりから。
        </p>
      ) : null}

      {equivalent.wastedYen > 0 ? (
        <p className="house-equivalent-animation__waste">
          累計浪費額は家{equivalent.wastedHouseEquivalentCount}
          軒分を失った可能性があります。
        </p>
      ) : null}
    </section>
  );
}
