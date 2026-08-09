import { describe, expect, it, vi } from "vitest";

import {
  createGraphDataSourceService,
  unavailableGraphQueryService,
} from "./graphDataSource";

const validParams = {
  accountId: "local-account",
  period: "day" as const,
  metric: "usageSeconds" as const,
};

const validGraphData = {
  period: "day" as const,
  metric: "usageSeconds" as const,
  points: [],
};

describe("graphDataSource", () => {
  it("adapts a dependency query into the graph query service", async () => {
    const query = vi.fn().mockResolvedValue(validGraphData);
    const service = createGraphDataSourceService({ query });

    await expect(service.getGraphData(validParams)).resolves.toEqual(
      validGraphData,
    );
    expect(query).toHaveBeenCalledWith(validParams);
  });

  it("reports an unconnected dependency without fake data", async () => {
    await expect(
      unavailableGraphQueryService.getGraphData(validParams),
    ).rejects.toMatchObject({
      code: "DATA_SOURCE_NOT_CONNECTED",
      message: "グラフデータ取得元が未接続です。",
    });
  });
});
