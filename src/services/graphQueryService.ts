import type { GraphData, GraphMetric, GraphPeriod } from "../types/graph";
import {
  graphDataSchema,
  graphMetricSchema,
  graphPeriodSchema,
} from "../utils/graphSchemas";

export type GraphQueryParams = Readonly<{
  accountId: string;
  period: GraphPeriod;
  metric: GraphMetric;
}>;

/**
 * #7/#12/#13の実装を、グラフ側から隠すための境界。
 * 実データ取得・集計・金額計算は依存Issue側で実装し、ここでは呼び出さない。
 */
export type GraphDataSource = {
  query(params: GraphQueryParams): Promise<unknown>;
};

export type GraphQueryService = {
  getGraphData(params: GraphQueryParams): Promise<GraphData>;
};

export type GraphQueryErrorCode =
  | "INVALID_QUERY"
  | "DATA_SOURCE_FAILED"
  | "DATA_SOURCE_NOT_CONNECTED"
  | "INVALID_RESPONSE";

export class GraphQueryError extends Error {
  constructor(
    public readonly code: GraphQueryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GraphQueryError";
  }
}

function validateGraphQueryParams(params: GraphQueryParams): void {
  if (typeof params.accountId !== "string" || params.accountId.trim() === "") {
    throw new GraphQueryError(
      "INVALID_QUERY",
      "アカウントを指定してください。",
    );
  }

  if (!graphPeriodSchema.safeParse(params.period).success) {
    throw new GraphQueryError(
      "INVALID_QUERY",
      "表示期間が正しくありません。",
    );
  }

  if (!graphMetricSchema.safeParse(params.metric).success) {
    throw new GraphQueryError(
      "INVALID_QUERY",
      "表示指標が正しくありません。",
    );
  }
}

export function createGraphQueryService(
  dataSource: GraphDataSource,
): GraphQueryService {
  return {
    async getGraphData(params: GraphQueryParams): Promise<GraphData> {
      validateGraphQueryParams(params);

      let rawData: unknown;
      try {
        rawData = await dataSource.query(params);
      } catch {
        throw new GraphQueryError(
          "DATA_SOURCE_FAILED",
          "利用履歴を取得できませんでした。",
        );
      }

      const parsed = graphDataSchema.safeParse(rawData);
      if (!parsed.success) {
        throw new GraphQueryError(
          "INVALID_RESPONSE",
          "グラフデータの形式が正しくありません。",
        );
      }

      if (
        parsed.data.period !== params.period ||
        parsed.data.metric !== params.metric
      ) {
        throw new GraphQueryError(
          "INVALID_RESPONSE",
          "グラフデータの表示条件が正しくありません。",
        );
      }

      return parsed.data;
    },
  };
}
