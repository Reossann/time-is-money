import {
  createGraphQueryService,
  GraphQueryError,
  type GraphDataSource,
  type GraphQueryService,
} from "./graphQueryService";

/**
 * #7/#12/#13の実装をGraphPageへ接続するadapter。
 * 依存Issueが完成したら、そのquery実装をここへ渡す。
 */
export function createGraphDataSourceService(
  dataSource: GraphDataSource,
): GraphQueryService {
  return createGraphQueryService(dataSource);
}

/** 依存Issue未完了時に、偽データを出さず安全に状態を表示するservice。 */
export const unavailableGraphQueryService: GraphQueryService = {
  async getGraphData() {
    throw new GraphQueryError(
      "DATA_SOURCE_NOT_CONNECTED",
      "グラフデータ取得元が未接続です。",
    );
  },
};
