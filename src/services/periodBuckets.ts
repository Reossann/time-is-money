import type {
  AggregationGranularity,
  AggregationQuery,
  PeriodAggregate,
} from "../types/aggregation";
import { aggregationQuerySchema } from "../utils/aggregationSchemas";
import {
  addCalendarDays,
  addCalendarMonths,
  calendarDateStartToUtc,
  formatCalendarDate,
  formatCalendarMonth,
  formatIsoWeekKey,
  startOfCalendarMonth,
  startOfIsoWeek,
  toZonedDateTime,
  type CalendarDate,
} from "../utils/calendarMath";

export type PeriodBucket = PeriodAggregate["period"];

function toIsoTimestamp(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

function createBucket(
  granularity: AggregationGranularity,
  date: CalendarDate,
  timeZoneId: string,
): PeriodBucket {
  const startDate =
    granularity === "day"
      ? date
      : granularity === "week"
        ? startOfIsoWeek(date)
        : startOfCalendarMonth(date);
  const endDate =
    granularity === "day"
      ? addCalendarDays(startDate, 1)
      : granularity === "week"
        ? addCalendarDays(startDate, 7)
        : addCalendarMonths(startDate, 1);
  const key =
    granularity === "day"
      ? formatCalendarDate(startDate)
      : granularity === "week"
        ? formatIsoWeekKey(startDate)
        : formatCalendarMonth(startDate);

  return Object.freeze({
    granularity,
    key,
    startAt: toIsoTimestamp(calendarDateStartToUtc(startDate, timeZoneId)),
    endAt: toIsoTimestamp(calendarDateStartToUtc(endDate, timeZoneId)),
    timeZoneId,
  });
}

function nextDate(granularity: AggregationGranularity, date: CalendarDate): CalendarDate {
  if (granularity === "day") return addCalendarDays(date, 1);
  if (granularity === "week") return addCalendarDays(startOfIsoWeek(date), 7);
  return addCalendarMonths(startOfCalendarMonth(date), 1);
}

/**
 * Generates every calendar period that intersects the query's `[from, to)`
 * range, in ascending order. Callers use this same list to assign records and,
 * when requested, emit zero-filled periods.
 */
export function createPeriodBuckets(input: AggregationQuery): readonly PeriodBucket[] {
  const query = aggregationQuerySchema.parse(input);
  const fromMs = Date.parse(query.from);
  const toMs = Date.parse(query.to);
  let cursor: CalendarDate = toZonedDateTime(fromMs, query.timeZoneId);
  const buckets: PeriodBucket[] = [];

  while (true) {
    const bucket = createBucket(query.granularity, cursor, query.timeZoneId);
    const bucketStartMs = Date.parse(bucket.startAt);
    if (bucketStartMs >= toMs) break;
    if (Date.parse(bucket.endAt) > fromMs) buckets.push(bucket);
    cursor = nextDate(query.granularity, cursor);
  }

  return Object.freeze(buckets);
}

export function createEmptyPeriodAggregates(
  input: AggregationQuery,
): readonly PeriodAggregate[] {
  const query = aggregationQuerySchema.parse(input);
  if (query.includeEmptyPeriods !== true) return Object.freeze([]);
  return Object.freeze(
    createPeriodBuckets(query).map((period) =>
      Object.freeze({
        period,
        sessionCount: 0,
        durationSeconds: 0,
        trackedDurationSeconds: 0,
        untrackedDurationSeconds: 0,
        earnedYen: 0,
        wastedYen: 0,
        netYen: 0,
      }),
    ),
  );
}
