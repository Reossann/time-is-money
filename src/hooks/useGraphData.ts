import { useCallback, useEffect, useState } from "react";

import {
  GraphQueryError,
  type GraphQueryParams,
  type GraphQueryService,
} from "../services/graphQueryService";
import type { GraphData } from "../types/graph";

export type GraphDataStatus =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "error";

export type GraphDataState = Readonly<{
  status: GraphDataStatus;
  data: GraphData | null;
  errorMessage: string | null;
  retry: () => void;
}>;

type UseGraphDataOptions = Readonly<{
  service: GraphQueryService;
  params: GraphQueryParams;
}>;

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof GraphQueryError) {
    return error.message;
  }

  return "グラフデータを取得できませんでした。";
}

export function useGraphData({ service, params }: UseGraphDataOptions): GraphDataState {
  const [state, setState] = useState<Omit<GraphDataState, "retry">>({
    status: "idle",
    data: null,
    errorMessage: null,
  });
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => {
    setRetryCount((count) => count + 1);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const queryParams: GraphQueryParams = {
      accountId: params.accountId,
      period: params.period,
      metric: params.metric,
    };

    setState({
      status: "loading",
      data: null,
      errorMessage: null,
    });

    void service.getGraphData(queryParams).then(
      (data) => {
        if (isCancelled) return;

        setState({
          status: data.points.length === 0 ? "empty" : "success",
          data,
          errorMessage: null,
        });
      },
      (error: unknown) => {
        if (isCancelled) return;

        setState({
          status: "error",
          data: null,
          errorMessage: getSafeErrorMessage(error),
        });
      },
    );

    return () => {
      isCancelled = true;
    };
  }, [params.accountId, params.metric, params.period, retryCount, service]);

  return { ...state, retry };
}
