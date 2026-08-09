import type { MoneyAnimationMode } from "../../types/moneyAnimation";

export type MoneyAnimationFixture = Readonly<{
  id: string;
  amountYen: number;
  mode: MoneyAnimationMode;
}>;

export const MONEY_ANIMATION_FIXTURES: readonly MoneyAnimationFixture[] = [
  { id: "earned-zero", amountYen: 0, mode: "earned" },
  { id: "wasted-zero", amountYen: 0, mode: "wasted" },
  { id: "earned-one-yen", amountYen: 1, mode: "earned" },
  { id: "wasted-1-234-yen", amountYen: 1_234, mode: "wasted" },
  { id: "earned-10-000-yen", amountYen: 10_000, mode: "earned" },
  { id: "wasted-ten-million-yen", amountYen: 10_000_000, mode: "wasted" },
  {
    id: "earned-max-safe-integer-yen",
    amountYen: Number.MAX_SAFE_INTEGER,
    mode: "earned",
  },
];
