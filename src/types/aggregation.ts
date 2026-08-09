export const AGGREGATION_SCHEMA_VERSION = 1 as const;

export type AggregationGranularity = "day" | "week" | "month";

export type AggregationQuery = Readonly<{
  ownerId: string;
  granularity: AggregationGranularity;
  /** UTC ISO-8601 timestamp, inclusive. */
  from: string;
  /** UTC ISO-8601 timestamp, exclusive. */
  to: string;
  /** IANA timezone captured by the caller. */
  timeZoneId: string;
  includeEmptyPeriods?: boolean;
}>;

export type PeriodAggregate = Readonly<{
  period: Readonly<{
    granularity: AggregationGranularity;
    /** day: YYYY-MM-DD, week: YYYY-Www, month: YYYY-MM */
    key: string;
    /** UTC ISO-8601 timestamp, inclusive. */
    startAt: string;
    /** UTC ISO-8601 timestamp, exclusive. */
    endAt: string;
    timeZoneId: string;
  }>;
  sessionCount: number;
  durationSeconds: number;
  trackedDurationSeconds: number;
  untrackedDurationSeconds: number;
  earnedYen: number;
  wastedYen: number;
  netYen: number;
}>;

export type AggregationErrorCode =
  | "OWNER_CONTEXT_REQUIRED"
  | "INVALID_PERIOD_RANGE"
  | "UNSUPPORTED_TIME_ZONE"
  | "HISTORY_QUERY_FAILED";

export class AggregationError extends Error {
  constructor(
    public readonly code: AggregationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AggregationError";
  }
}
