import { useCallback, useEffect, useState } from "react";

import type { AggregationClient } from "../services/aggregationClient";
import { AggregationError, type AggregationQuery, type PeriodAggregate } from "../types/aggregation";

export type PeriodAggregatesStatus = "idle" | "loading" | "success" | "empty" | "error";

export type PeriodAggregatesState = Readonly<{
  status: PeriodAggregatesStatus;
  data: readonly PeriodAggregate[] | null;
  errorMessage: string | null;
  retry: () => void;
}>;

type UsePeriodAggregatesOptions = Readonly<{
  client: AggregationClient;
  query: AggregationQuery;
}>;

function safeErrorMessage(error: unknown): string {
  if (error instanceof AggregationError && error.code === "QUERY_LIMIT_EXCEEDED") {
    return "集計できる期間または件数の上限を超えています。";
  }
  return "集計データを取得できませんでした。";
}

export function usePeriodAggregates({
  client,
  query,
}: UsePeriodAggregatesOptions): PeriodAggregatesState {
  const {
    ownerId,
    granularity,
    from,
    to,
    timeZoneId,
    includeEmptyPeriods,
  } = query;
  const [state, setState] = useState<Omit<PeriodAggregatesState, "retry">>({
    status: "idle",
    data: null,
    errorMessage: null,
  });
  const [retryCount, setRetryCount] = useState(0);
  const retry = useCallback(() => setRetryCount((count) => count + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", data: null, errorMessage: null });

    void client.getPeriodAggregates({
      ownerId,
      granularity,
      from,
      to,
      timeZoneId,
      includeEmptyPeriods,
    }).then(
      (data) => {
        if (cancelled) return;
        setState({
          status: data.length === 0 ? "empty" : "success",
          data,
          errorMessage: null,
        });
      },
      (error: unknown) => {
        if (cancelled) return;
        setState({ status: "error", data: null, errorMessage: safeErrorMessage(error) });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [
    client,
    ownerId,
    granularity,
    from,
    to,
    timeZoneId,
    includeEmptyPeriods,
    retryCount,
  ]);

  return { ...state, retry };
}
