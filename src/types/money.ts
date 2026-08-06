import type { ActivityCategory } from "./activity";

export type MoneyCalculationInput = Readonly<{
  /** Completed duration in seconds. Must be a non-negative safe integer. */
  durationSeconds: number;
  /** Hourly rate in JPY. Must be a non-negative finite number. */
  hourlyRateYen: number;
  /** null or undefined means the activity is unclassified. */
  category?: ActivityCategory | null;
}>;

export type MoneyBreakdown = Readonly<{
  /** Earned amount in whole JPY. Must be a non-negative safe integer. */
  earnedYen: number;
  /** Wasted amount in whole JPY. Must be a non-negative safe integer. */
  wastedYen: number;
  /** Net amount in whole JPY. Always earnedYen minus wastedYen. */
  netYen: number;
}>;

export type MoneyCalculationErrorCode =
  | "INVALID_DURATION_SECONDS"
  | "INVALID_HOURLY_RATE"
  | "UNKNOWN_CATEGORY"
  | "AMOUNT_OUT_OF_RANGE"
  | "INVALID_MONEY_BREAKDOWN";
