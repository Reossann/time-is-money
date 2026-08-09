import { createSqliteSessionRecordRepository } from "../repositories/sqliteSessionRecordRepository";
import { AggregationError, type AggregationQuery, type PeriodAggregate } from "../types/aggregation";
import { aggregateSessionHistory } from "./aggregationService";
import {
  createSessionHistoryAdapter,
  type SessionHistoryAdapter,
} from "./sessionHistoryAdapter";

export const MAX_AGGREGATION_RANGE_MILLISECONDS = 366 * 24 * 60 * 60 * 1_000;

export interface AggregationClient {
  getPeriodAggregates(input: AggregationQuery): Promise<readonly PeriodAggregate[]>;
}

export function createAggregationClient(
  history: SessionHistoryAdapter = createSessionHistoryAdapter(
    createSqliteSessionRecordRepository(),
  ),
): AggregationClient {
  return Object.freeze({
    async getPeriodAggregates(
      input: AggregationQuery,
    ): Promise<readonly PeriodAggregate[]> {
      const fromMilliseconds = Date.parse(input.from);
      const toMilliseconds = Date.parse(input.to);
      if (
        Number.isFinite(fromMilliseconds) &&
        Number.isFinite(toMilliseconds) &&
        toMilliseconds - fromMilliseconds > MAX_AGGREGATION_RANGE_MILLISECONDS
      ) {
        throw new AggregationError("QUERY_LIMIT_EXCEEDED", "aggregation range limit exceeded");
      }
      // The domain service owns validation so client callers retain its stable error codes.
      return aggregateSessionHistory(input, history);
    },
  });
}

/** The only production entrypoint for calendar and graph consumers. */
export const aggregationClient = createAggregationClient();
