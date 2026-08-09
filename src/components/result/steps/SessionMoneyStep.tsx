import { MoneyAnimation } from "../MoneyAnimation";
import type { ResultStepProps } from "./ResultStepPlaceholder";

const PREVIEW_MONEY_ANIMATIONS = [
  { amountYen: 10_000, mode: "earned" },
  { amountYen: 1_234, mode: "wasted" },
  { amountYen: 0, mode: "earned" },
] as const;

export function SessionMoneyStep({
  content,
  status,
  animationSkipped,
}: ResultStepProps) {
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
        開発用fixtureです。実際の金額・保存結果・設定変更は行いません。
      </p>
      <div className="session-money-step__animations">
        {PREVIEW_MONEY_ANIMATIONS.map(({ amountYen, mode }) => (
          <MoneyAnimation
            key={`${mode}-${amountYen}`}
            amountYen={amountYen}
            mode={mode}
            playState={animationSkipped ? "skipped" : "playing"}
            runId={`session-money-preview-${mode}-${amountYen}`}
          />
        ))}
      </div>
      {animationSkipped ? (
        <p className="result-step__skip-status" role="status">
          このステップの演出をスキップしました。表示内容は変わりません。
        </p>
      ) : null}
    </section>
  );
}
