import { MoneyAnimation } from "../MoneyAnimation";
import { MONEY_ANIMATION_PREVIEW_FIXTURES } from "../../../test/fixtures/moneyAnimation";
import type { MoneyAnimationCompleteReason } from "../../../types/moneyAnimation";
import type { SessionResult } from "../../../types/sessionResult";
import type { ResultStepProps } from "./ResultStepPlaceholder";

type MoneyAnimationCompletion = Readonly<{
  mode: "earned" | "wasted";
  reason: MoneyAnimationCompleteReason;
  runId: string;
}>;

export type SessionMoneyStepProps = ResultStepProps & {
  sessionResult?: SessionResult | null;
  onAnimationComplete?: (completion: MoneyAnimationCompletion) => void;
};

function formatNetYen(netYen: number): string {
  const sign = netYen > 0 ? "+" : netYen < 0 ? "−" : "";
  return `${sign}${new Intl.NumberFormat("ja-JP").format(Math.abs(netYen))}円`;
}

export function SessionMoneyStep({
  content,
  status,
  animationSkipped,
  sessionResult,
  onAnimationComplete,
}: SessionMoneyStepProps) {
  const moneyAnimations = sessionResult
    ? [
        {
          id: "earned",
          amountYen: sessionResult.totals.earnedYen,
          mode: "earned" as const,
        },
        {
          id: "wasted",
          amountYen: sessionResult.totals.wastedYen,
          mode: "wasted" as const,
        },
      ]
    : MONEY_ANIMATION_PREVIEW_FIXTURES;

  return (
    <section
      className="result-step session-money-step"
      aria-labelledby="result-step-session-money"
    >
      <p className="result-step__status">
        {status === "placeholder" ? "準備中" : "接続済み"}
      </p>
      <h1
        id="result-step-session-money"
        className="result-step__title"
        tabIndex={-1}
      >
        {content.title}
      </h1>
      <p className="result-step__description">{content.description}</p>
      <p className="result-step__issue">担当: {content.responsibleIssue}</p>
      <p className="result-step__notice">
        {sessionResult
          ? "確定済みSessionResultの金額をそのまま表示しています。"
          : "開発用fixtureです。実際の金額・保存結果・設定変更は行いません。"}
      </p>
      {sessionResult ? (
        <p className="session-money-step__net">
          今回の純増減: <strong>{formatNetYen(sessionResult.totals.netYen)}</strong>
        </p>
      ) : null}
      <div className="session-money-step__animations">
        {moneyAnimations.map(({ id, amountYen, mode }) => {
          const runId = sessionResult
            ? `${sessionResult.sessionId}-${mode}`
            : `session-money-preview-${id}`;

          return (
          <MoneyAnimation
            key={id}
            amountYen={amountYen}
            mode={mode}
            playState={animationSkipped ? "skipped" : "playing"}
            runId={runId}
            onComplete={(reason) =>
              onAnimationComplete?.({ mode, reason, runId })
            }
          />
          );
        })}
      </div>
      {animationSkipped ? (
        <p className="result-step__skip-status" role="status">
          このステップの演出をスキップしました。表示内容は変わりません。
        </p>
      ) : null}
    </section>
  );
}
