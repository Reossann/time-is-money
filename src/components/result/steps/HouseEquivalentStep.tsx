import { useEffect, useState } from "react";

import { HouseEquivalentAnimation } from "../HouseEquivalentAnimation";
import {
  calculateHouseEquivalent,
} from "../../../services/houseEquivalentService";
import {
  lifetimeMoneySummaryService,
  type LifetimeMoneySummaryService,
} from "../../../services/lifetimeMoneySummaryService";
import {
  ownerIdentityService,
  type OwnerIdentityService,
} from "../../../services/ownerIdentityService";
import {
  ResultStepPlaceholder,
  type ResultStepProps,
} from "./ResultStepPlaceholder";

type HouseEquivalentStepProps = ResultStepProps &
  Readonly<{
    lifetimeSummary?: Pick<LifetimeMoneySummaryService, "getSummary">;
    ownerIdentity?: Pick<OwnerIdentityService, "getCurrentOwnerId">;
  }>;

type ConnectedHouseEquivalentState =
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "empty" }>
  | Readonly<{
      status: "ready";
      earnedYen: number;
      wastedYen: number;
    }>
  | Readonly<{ status: "error" }>;

const EMPTY_HOUSE_EQUIVALENT = calculateHouseEquivalent({
  earnedYen: 0,
  wastedYen: 0,
});

function HouseEquivalentConnectedStep({
  animationSkipped,
  content,
  lifetimeSummary = lifetimeMoneySummaryService,
  ownerIdentity = ownerIdentityService,
}: HouseEquivalentStepProps) {
  const [retryVersion, setRetryVersion] = useState(0);
  const [state, setState] = useState<ConnectedHouseEquivalentState>({
    status: "loading",
  });

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      setState({ status: "loading" });
      try {
        const ownerId = await ownerIdentity.getCurrentOwnerId();
        const summary = await lifetimeSummary.getSummary(ownerId);
        if (disposed) return;

        if (summary.sessionCount === 0) {
          setState({ status: "empty" });
          return;
        }

        setState({
          status: "ready",
          earnedYen: summary.earnedYen,
          wastedYen: summary.wastedYen,
        });
      } catch {
        if (!disposed) setState({ status: "error" });
      }
    };

    void load();
    return () => {
      disposed = true;
    };
  }, [lifetimeSummary, ownerIdentity, retryVersion]);

  return (
    <section className="result-step" aria-labelledby="result-step-house-equivalent">
      <h1
        id="result-step-house-equivalent"
        className="result-step__title"
        tabIndex={-1}
      >
        {content.title}
      </h1>
      <p className="result-step__description">{content.description}</p>
      {state.status === "loading" ? (
        <p className="result-step__notice" role="status">
          累計金額を読み込んでいます。
        </p>
      ) : null}
      {state.status === "empty" ? (
        <>
          <p className="result-step__notice">記録がまだありません。</p>
          <HouseEquivalentAnimation
            animationSkipped={animationSkipped}
            equivalent={EMPTY_HOUSE_EQUIVALENT}
          />
        </>
      ) : null}
      {state.status === "ready" ? (
        <HouseEquivalentAnimation
          animationSkipped={animationSkipped}
          equivalent={calculateHouseEquivalent({
            earnedYen: state.earnedYen,
            wastedYen: state.wastedYen,
          })}
        />
      ) : null}
      {state.status === "error" ? (
        <div className="calendar-save">
          <p className="calendar-save__error" role="alert">
            累計金額を取得できませんでした。
          </p>
          <button
            className="calendar-save__retry"
            onClick={() => setRetryVersion((version) => version + 1)}
            type="button"
          >
            再試行
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function HouseEquivalentStep(props: HouseEquivalentStepProps) {
  if (props.status !== "ready") {
    return <ResultStepPlaceholder step="house-equivalent" {...props} />;
  }

  return <HouseEquivalentConnectedStep {...props} />;
}
