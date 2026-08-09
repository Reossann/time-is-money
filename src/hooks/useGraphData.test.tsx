import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GraphQueryParams, GraphQueryService } from "../services/graphQueryService";
import { useGraphData } from "./useGraphData";

const params: GraphQueryParams = {
  accountId: "local-account",
  period: "day",
  metric: "netYen",
};

const graphData = {
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

function Harness({ service }: { service: GraphQueryService }) {
  const state = useGraphData({ service, params });

  return (
    <div>
      <span data-testid="status">{state.status}</span>
      <span data-testid="error">{state.errorMessage ?? ""}</span>
      <button type="button" onClick={state.retry}>
        再試行
      </button>
    </div>
  );
}

describe("useGraphData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading and then success", async () => {
    const service: GraphQueryService = {
      getGraphData: vi.fn().mockResolvedValue(graphData),
    };

    render(<Harness service={service} />);

    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("success"),
    );
    expect(service.getGraphData).toHaveBeenCalledWith(params);
  });

  it("shows empty when the response has no points", async () => {
    const service: GraphQueryService = {
      getGraphData: vi.fn().mockResolvedValue({
        period: "day",
        metric: "netYen",
        points: [],
      }),
    };

    render(<Harness service={service} />);

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("empty"),
    );
  });

  it("shows a safe error message when loading fails", async () => {
    const service: GraphQueryService = {
      getGraphData: vi
        .fn()
        .mockRejectedValue(new Error("private database path")),
    };

    render(<Harness service={service} />);

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("error"),
    );
    expect(screen.getByTestId("error")).toHaveTextContent(
      "グラフデータを取得できませんでした。",
    );
    expect(screen.getByTestId("error")).not.toHaveTextContent(
      "private database path",
    );
  });

  it("retries after a failed request", async () => {
    const service: GraphQueryService = {
      getGraphData: vi
        .fn()
        .mockRejectedValueOnce(new Error("temporary failure"))
        .mockResolvedValueOnce(graphData),
    };

    render(<Harness service={service} />);
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("error"),
    );

    screen.getByRole("button", { name: "再試行" }).click();

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("success"),
    );
    expect(service.getGraphData).toHaveBeenCalledTimes(2);
  });
});
