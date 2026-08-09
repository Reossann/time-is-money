import { describe, expect, it, vi } from "vitest";

import {
  createGraphQueryService,
  type GraphQueryParams,
} from "./graphQueryService";

const validParams: GraphQueryParams = {
  accountId: "local-account",
  period: "day",
  metric: "netYen",
};

const validGraphData = {
  period: "day",
  metric: "netYen",
  points: [
    {
      dateKey: "2026-08-09",
      label: "8/9",
      usageSeconds: 3_600,
      earnedYen: 1_000,
      wastedYen: 200,
      netYen: 800,
    },
  ],
} as const;

describe("createGraphQueryService", () => {
  it("queries the data source and validates the response", async () => {
    const query = vi.fn().mockResolvedValue(validGraphData);
    const service = createGraphQueryService({ query });

    await expect(service.getGraphData(validParams)).resolves.toEqual(
      validGraphData,
    );
    expect(query).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(validParams);
  });

  it("rejects an empty account id without querying", async () => {
    const query = vi.fn();
    const service = createGraphQueryService({ query });

    await expect(
      service.getGraphData({ ...validParams, accountId: " " }),
    ).rejects.toMatchObject({
      code: "INVALID_QUERY",
      message: "アカウントを指定してください。",
    });
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    ["period", { period: "year" }],
    ["metric", { metric: "cost" }],
  ])("rejects an invalid %s without querying", async (_name, override) => {
    const query = vi.fn();
    const service = createGraphQueryService({ query });

    await expect(
      service.getGraphData({ ...validParams, ...override } as GraphQueryParams),
    ).rejects.toMatchObject({
      code: "INVALID_QUERY",
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("hides data source errors behind a safe message", async () => {
    const query = vi.fn().mockRejectedValue(new Error("private database path"));
    const service = createGraphQueryService({ query });

    await expect(service.getGraphData(validParams)).rejects.toMatchObject({
      code: "DATA_SOURCE_FAILED",
      message: "利用履歴を取得できませんでした。",
    });
  });

  it("rejects a response that does not match the graph schema", async () => {
    const query = vi.fn().mockResolvedValue({
      ...validGraphData,
      points: [{ ...validGraphData.points[0], netYen: 999 }],
    });
    const service = createGraphQueryService({ query });

    await expect(service.getGraphData(validParams)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      message: "グラフデータの形式が正しくありません。",
    });
  });

  it("rejects a response for a different period or metric", async () => {
    const query = vi.fn().mockResolvedValue({
      ...validGraphData,
      period: "week",
      metric: "earnedYen",
    });
    const service = createGraphQueryService({ query });

    await expect(service.getGraphData(validParams)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      message: "グラフデータの表示条件が正しくありません。",
    });
  });

  it("allows an empty but valid response", async () => {
    const query = vi.fn().mockResolvedValue({
      period: "day",
      metric: "netYen",
      points: [],
    });
    const service = createGraphQueryService({ query });

    await expect(service.getGraphData(validParams)).resolves.toEqual({
      period: "day",
      metric: "netYen",
      points: [],
    });
  });
});
