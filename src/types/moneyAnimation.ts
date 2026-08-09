export type MoneyAnimationMode = "earned" | "wasted";

export type MoneyAnimationPlayState = "idle" | "playing" | "skipped";

export type MoneyAnimationCompleteReason =
  | "finished"
  | "skipped"
  | "reduced-motion"
  | "zero";

export type MoneyAnimationProps = Readonly<{
  amountYen: number;
  mode: MoneyAnimationMode;
  playState: MoneyAnimationPlayState;
  runId: string;
  onStart?: () => void;
  onComplete?: (reason: MoneyAnimationCompleteReason) => void;
}>;

export type MoneyAnimationDisplayModel = Readonly<{
  amountYen: number;
  formattedAmount: string;
  amountLabel: string;
  mode: MoneyAnimationMode;
  modeLabel: string;
  description: string;
  particleCount: number;
  isZero: boolean;
}>;

export type MoneyAnimationErrorCode = "INVALID_AMOUNT_YEN" | "INVALID_MODE";
