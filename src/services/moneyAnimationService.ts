import {
  MONEY_ANIMATION_MAX_PARTICLE_COUNT,
  MONEY_ANIMATION_MIN_PARTICLE_COUNT,
  MONEY_ANIMATION_PARTICLE_STEPS,
} from "../constants/moneyAnimation";
import type {
  MoneyAnimationDisplayModel,
  MoneyAnimationErrorCode,
  MoneyAnimationMode,
} from "../types/moneyAnimation";

type MoneyAnimationDisplayInput = Readonly<{
  amountYen: number;
  mode: MoneyAnimationMode;
}>;

const MODE_COPY: Readonly<
  Record<
    MoneyAnimationMode,
    Readonly<{ amountLabel: string; modeLabel: string; description: string }>
  >
> = {
  earned: {
    amountLabel: "今回得になった金額",
    modeLabel: "獲得",
    description: "コインが集まり、積み上がります。",
  },
  wasted: {
    amountLabel: "今回浪費した金額",
    modeLabel: "浪費",
    description: "コインが流出し、薄くなります。",
  },
};

export class MoneyAnimationError extends Error {
  constructor(
    public readonly code: MoneyAnimationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MoneyAnimationError";
  }
}

export function validateMoneyAnimationInput(
  input: MoneyAnimationDisplayInput,
): void {
  if (!Number.isSafeInteger(input.amountYen) || input.amountYen < 0) {
    throw new MoneyAnimationError(
      "INVALID_AMOUNT_YEN",
      "amountYen must be a non-negative safe integer",
    );
  }

  if (!(input.mode in MODE_COPY)) {
    throw new MoneyAnimationError(
      "INVALID_MODE",
      "mode must be earned or wasted",
    );
  }
}

export function formatMoneyAnimationAmount(amountYen: number): string {
  if (!Number.isSafeInteger(amountYen) || amountYen < 0) {
    throw new MoneyAnimationError(
      "INVALID_AMOUNT_YEN",
      "amountYen must be a non-negative safe integer",
    );
  }

  return `${new Intl.NumberFormat("ja-JP").format(amountYen)}円`;
}

export function amountToVisualCount(amountYen: number): number {
  if (!Number.isSafeInteger(amountYen) || amountYen < 0) {
    throw new MoneyAnimationError(
      "INVALID_AMOUNT_YEN",
      "amountYen must be a non-negative safe integer",
    );
  }

  if (amountYen === 0) return 0;

  const step = [...MONEY_ANIMATION_PARTICLE_STEPS]
    .reverse()
    .find((candidate) => amountYen >= candidate.minimumAmountYen);

  return Math.min(
    MONEY_ANIMATION_MAX_PARTICLE_COUNT,
    Math.max(MONEY_ANIMATION_MIN_PARTICLE_COUNT, step?.particleCount ?? 0),
  );
}

export function createMoneyAnimationDisplayModel(
  input: MoneyAnimationDisplayInput,
): MoneyAnimationDisplayModel {
  validateMoneyAnimationInput(input);

  const copy = MODE_COPY[input.mode];
  return Object.freeze({
    amountYen: input.amountYen,
    formattedAmount: formatMoneyAnimationAmount(input.amountYen),
    amountLabel: copy.amountLabel,
    mode: input.mode,
    modeLabel: copy.modeLabel,
    description: copy.description,
    particleCount: amountToVisualCount(input.amountYen),
    isZero: input.amountYen === 0,
  });
}
