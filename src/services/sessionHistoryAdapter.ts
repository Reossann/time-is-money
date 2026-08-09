import type { SessionRecordRepository } from "../repositories/sessionRecordRepository";
import type { SessionRecord } from "../types/sessionRecord";
import { AggregationError } from "../types/aggregation";

export const MAX_AGGREGATION_HISTORY_RECORDS = 10_000;

export interface SessionHistoryAdapter {
  /** Returns only the requested owner's persisted records in `[fromMs, toMs)`. */
  listByOwnerAndRange(
    ownerId: string,
    fromMs: number,
    toMs: number,
  ): Promise<readonly SessionRecord[]>;
}

/**
 * Keeps the current #35 repository shape behind the aggregation boundary.
 * Phase 4 can replace this with an owner-scoped SQL range query without
 * changing the aggregation service or its consumers.
 */
export function createSessionHistoryAdapter(
  repository: Pick<SessionRecordRepository, "listByOwnerInRange">,
  maxRecords = MAX_AGGREGATION_HISTORY_RECORDS,
): SessionHistoryAdapter {
  return Object.freeze({
    async listByOwnerAndRange(
      ownerId: string,
      fromMs: number,
      toMs: number,
    ): Promise<readonly SessionRecord[]> {
      const records = await repository.listByOwnerInRange(
        ownerId,
        fromMs,
        toMs,
        maxRecords + 1,
      );
      if (records.length > maxRecords) {
        throw new AggregationError("QUERY_LIMIT_EXCEEDED", "history result limit exceeded");
      }
      return Object.freeze(
        records.filter(
          (record) => record.ownerId === ownerId && record.endedAt >= fromMs && record.endedAt < toMs,
        ),
      );
    },
  });
}
