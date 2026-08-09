import type { SessionRecord } from "../types/sessionRecord";
import {
  AggregationError,
  type AggregationQuery,
  type LifetimeMoneySummary,
  type PeriodAggregate,
} from "../types/aggregation";
import {
  aggregationQuerySchema,
  isSupportedTimeZone,
} from "../utils/aggregationSchemas";
import { createPeriodBuckets, type PeriodBucket } from "./periodBuckets";
import type { SessionHistoryAdapter } from "./sessionHistoryAdapter";

type MutableAggregate = {
  sessionCount: number;
  durationSeconds: number;
  trackedDurationSeconds: number;
  untrackedDurationSeconds: number;
  earnedYen: number;
  wastedYen: number;
  netYen: number;
};

function fail(code: AggregationError["code"]): never {
  throw new AggregationError(code, code);
}

function parseQuery(input: AggregationQuery): AggregationQuery {
  if (typeof input.ownerId !== "string" || input.ownerId.trim().length === 0) {
    return fail("OWNER_CONTEXT_REQUIRED");
  }
  if (typeof input.timeZoneId !== "string" || !isSupportedTimeZone(input.timeZoneId)) {
    return fail("UNSUPPORTED_TIME_ZONE");
  }
  try {
    return aggregationQuerySchema.parse(input);
  } catch {
    return fail("INVALID_PERIOD_RANGE");
  }
}

function parseOwnerId(ownerId: string): string {
  if (typeof ownerId !== "string" || ownerId.trim().length === 0) {
    return fail("OWNER_CONTEXT_REQUIRED");
  }

  return ownerId.trim();
}

function safeAdd(current: number, value: number): number {
  const next = current + value;
  if (!Number.isSafeInteger(next)) return fail("AGGREGATION_OVERFLOW");
  return next;
}

function emptyAggregate(): MutableAggregate {
  return {
    sessionCount: 0,
    durationSeconds: 0,
    trackedDurationSeconds: 0,
    untrackedDurationSeconds: 0,
    earnedYen: 0,
    wastedYen: 0,
    netYen: 0,
  };
}

function findBucket(record: SessionRecord, buckets: readonly PeriodBucket[]): PeriodBucket | undefined {
  return buckets.find(
    (bucket) =>
      record.endedAt >= Date.parse(bucket.startAt) && record.endedAt < Date.parse(bucket.endAt),
  );
}

function addRecord(target: MutableAggregate, record: SessionRecord): void {
  target.sessionCount = safeAdd(target.sessionCount, 1);
  target.durationSeconds = safeAdd(target.durationSeconds, record.durationSeconds);
  target.trackedDurationSeconds = safeAdd(
    target.trackedDurationSeconds,
    record.trackedDurationSeconds,
  );
  target.untrackedDurationSeconds = safeAdd(
    target.untrackedDurationSeconds,
    record.untrackedDurationSeconds,
  );
  target.earnedYen = safeAdd(target.earnedYen, record.totals.earnedYen);
  target.wastedYen = safeAdd(target.wastedYen, record.totals.wastedYen);
  target.netYen = safeAdd(target.netYen, record.totals.netYen);
}

function toPeriodAggregate(
  period: PeriodBucket,
  aggregate: MutableAggregate,
): PeriodAggregate {
  return Object.freeze({
    period,
    sessionCount: aggregate.sessionCount,
    durationSeconds: aggregate.durationSeconds,
    trackedDurationSeconds: aggregate.trackedDurationSeconds,
    untrackedDurationSeconds: aggregate.untrackedDurationSeconds,
    earnedYen: aggregate.earnedYen,
    wastedYen: aggregate.wastedYen,
    netYen: aggregate.netYen,
  });
}

/** Aggregates immutable saved records; it never reads active measurement state or recalculates money. */
export async function aggregateSessionHistory(
  input: AggregationQuery,
  history: SessionHistoryAdapter,
): Promise<readonly PeriodAggregate[]> {
  const query = parseQuery(input);
  const fromMs = Date.parse(query.from);
  const toMs = Date.parse(query.to);
  const buckets = createPeriodBuckets(query);
  const totalsByKey = new Map<string, MutableAggregate>();
  for (const bucket of buckets) totalsByKey.set(bucket.key, emptyAggregate());

  let records: readonly SessionRecord[];
  try {
    records = await history.listByOwnerAndRange(query.ownerId, fromMs, toMs);
  } catch (error) {
    if (error instanceof AggregationError) throw error;
    return fail("HISTORY_QUERY_FAILED");
  }

  const seenSessionIds = new Set<string>();
  for (const record of records) {
    if (
      record.ownerId !== query.ownerId ||
      record.endedAt < fromMs ||
      record.endedAt >= toMs ||
      seenSessionIds.has(record.sessionId)
    ) {
      continue;
    }
    seenSessionIds.add(record.sessionId);
    const bucket = findBucket(record, buckets);
    if (bucket === undefined) continue;
    const aggregate = totalsByKey.get(bucket.key);
    if (aggregate !== undefined) addRecord(aggregate, record);
  }

  return Object.freeze(
    buckets
      .map((bucket) => toPeriodAggregate(bucket, totalsByKey.get(bucket.key) ?? emptyAggregate()))
      .filter((aggregate) => query.includeEmptyPeriods === true || aggregate.sessionCount > 0),
  );
}

/**
 * Returns exact owner-scoped totals from persisted history only. This intentionally
 * bypasses period buckets so lifetime totals are not limited to one calendar range.
 */
export async function aggregateLifetimeMoneySummary(
  ownerId: string,
  history: SessionHistoryAdapter,
): Promise<LifetimeMoneySummary> {
  const canonicalOwnerId = parseOwnerId(ownerId);
  let records: readonly SessionRecord[];

  try {
    records = await history.listByOwnerAndRange(
      canonicalOwnerId,
      0,
      Number.MAX_SAFE_INTEGER,
    );
  } catch (error) {
    if (error instanceof AggregationError) throw error;
    return fail("HISTORY_QUERY_FAILED");
  }

  const aggregate = emptyAggregate();
  const seenSessionIds = new Set<string>();
  for (const record of records) {
    if (record.ownerId !== canonicalOwnerId || seenSessionIds.has(record.sessionId)) {
      continue;
    }
    seenSessionIds.add(record.sessionId);
    addRecord(aggregate, record);
  }

  return Object.freeze({
    ownerId: canonicalOwnerId,
    sessionCount: aggregate.sessionCount,
    earnedYen: aggregate.earnedYen,
    wastedYen: aggregate.wastedYen,
    netYen: aggregate.netYen,
  });
}
