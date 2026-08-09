import type { AggregationClient } from "./aggregationClient";
import { presentGraphData } from "./aggregationPresenter";
import type { AggregationQuery } from "../types/aggregation";
import type { GraphQueryParams, GraphDataSource } from "./graphQueryService";

export type AggregationQueryResolver = (
  params: GraphQueryParams,
) => AggregationQuery;

/** Connects #41's generic graph source to the one #12 aggregation API. */
export function createAggregationGraphDataSource(
  client: AggregationClient,
  resolveQuery: AggregationQueryResolver,
): GraphDataSource {
  return Object.freeze({
    async query(params: GraphQueryParams): Promise<unknown> {
      const query = resolveQuery(params);
      const aggregates = await client.getPeriodAggregates({
        ...query,
        granularity: params.period,
      });
      return presentGraphData(aggregates, params.period, params.metric);
    },
  });
}
