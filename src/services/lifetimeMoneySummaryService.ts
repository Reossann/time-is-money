import {
  aggregationClient,
  type LifetimeAggregationClient,
} from "./aggregationClient";
import type { LifetimeMoneySummary } from "../types/aggregation";

export interface LifetimeMoneySummaryService {
  getSummary(ownerId: string): Promise<LifetimeMoneySummary>;
}

/** The #34 boundary for reading the one canonical persisted lifetime summary. */
export function createLifetimeMoneySummaryService(
  client: LifetimeAggregationClient = aggregationClient,
): LifetimeMoneySummaryService {
  return Object.freeze({
    getSummary(ownerId: string): Promise<LifetimeMoneySummary> {
      return client.getLifetimeMoneySummary(ownerId);
    },
  });
}

export const lifetimeMoneySummaryService = createLifetimeMoneySummaryService();
