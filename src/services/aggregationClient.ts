import { createSqliteSessionRecordRepository } from "../repositories/sqliteSessionRecordRepository";
import { AggregationError, type AggregationQuery, type PeriodAggregate } from "../types/aggregation";
import { aggregationQuerySchema } from "../utils/aggregationSchemas";
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
      let query: AggregationQuery;
      try {
        query = aggregationQuerySchema.parse(input);
      } catch {
        throw new AggregationError("INVALID_PERIOD_RANGE", "invalid aggregation query");
      }
      if (Date.parse(query.to) - Date.parse(query.from) > MAX_AGGREGATION_RANGE_MILLISECONDS) {
        throw new AggregationError("QUERY_LIMIT_EXCEEDED", "aggregation range limit exceeded");
      }
      return aggregateSessionHistory(query, history);
    },
  });
}

/** The only production entrypoint for calendar and graph consumers. */
export const aggregationClient = createAggregationClient();
