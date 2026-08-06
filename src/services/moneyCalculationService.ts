import type { ActivityCategory } from "../types/activity";
import type {
  MoneyCalculationErrorCode,
  MoneyCalculationInput,
} from "../types/money";

const ACTIVITY_CATEGORIES: ReadonlySet<ActivityCategory> = new Set([
  "productive",
  "waste",
  "neutral",
]);

export class MoneyCalculationError extends Error {
  constructor(
    public readonly code: MoneyCalculationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MoneyCalculationError";
  }
}

export function validateMoneyCalculationInput(
  input: MoneyCalculationInput,
): void {
  if (
    !Number.isSafeInteger(input.durationSeconds) ||
    input.durationSeconds < 0
  ) {
    throw new MoneyCalculationError(
      "INVALID_DURATION_SECONDS",
      "durationSeconds must be a non-negative safe integer",
    );
  }

  if (
    typeof input.hourlyRateYen !== "number" ||
    !Number.isFinite(input.hourlyRateYen) ||
    input.hourlyRateYen < 0
  ) {
    throw new MoneyCalculationError(
      "INVALID_HOURLY_RATE",
      "hourlyRateYen must be a non-negative finite number",
    );
  }

  const category: unknown = input.category;
  if (
    category !== undefined &&
    category !== null &&
    !ACTIVITY_CATEGORIES.has(category as ActivityCategory)
  ) {
    throw new MoneyCalculationError(
      "UNKNOWN_CATEGORY",
      "category must be productive, waste, neutral, null, or undefined",
    );
  }
}
