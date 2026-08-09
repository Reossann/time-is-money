import { MAX_RENDERED_COMPLETED_HOUSES } from "../../constants/houseEquivalent";
import type {
  HouseConstructionStage,
  HouseEquivalent,
} from "../../types/houseEquivalent";

type HouseEquivalentAnimationProps = Readonly<{
  equivalent: HouseEquivalent;
}>;

type HouseIllustrationProps = Readonly<{
  stage: HouseConstructionStage;
  completed?: boolean;
  testId?: string;
}>;

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
      }`}
      data-stage={visibleStage}
      data-testid={testId}
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
}: HouseEquivalentAnimationProps) {
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

  return (
    <section
      aria-labelledby="house-equivalent-heading"
      className="house-equivalent-animation"
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
              key={index}
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
