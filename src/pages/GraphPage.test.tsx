import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { GraphQueryService } from "../services/graphQueryService";
import { GraphPage } from "./GraphPage";

describe("GraphPage", () => {
  it("starts with day and changes the displayed period", () => {
    render(<GraphPage />);

    expect(screen.getByText("表示期間: 日")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "週" }));

    expect(screen.getByText("表示期間: 週")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "週" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("starts with usage time and changes the displayed metric", () => {
    render(<GraphPage />);

    expect(screen.getByText("表示指標: 利用時間")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "純増減" }));

    expect(screen.getByText("表示指標: 純増減")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "純増減" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("renders GraphData supplied by the dependency service", async () => {
    const graphService: GraphQueryService = {
      getGraphData: async () => ({
        period: "day",
        metric: "usageSeconds",
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
      }),
    };

    render(<GraphPage accountId="local-account" graphService={graphService} />);

    await waitFor(() =>
      expect(screen.getByRole("img", { name: "1件のusageSeconds推移グラフ" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("shows a safe error and retries the dependency service", async () => {
    let callCount = 0;
    const graphService: GraphQueryService = {
      getGraphData: async () => {
        callCount += 1;
        if (callCount === 1) {
          throw new Error("private database error");
        }

        return { period: "day", metric: "usageSeconds", points: [] };
      },
    };

    render(<GraphPage accountId="local-account" graphService={graphService} />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "グラフデータを取得できませんでした。",
      ),
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      "private database error",
    );

    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    await waitFor(() =>
      expect(screen.getByText("この期間のデータはありません。")).toBeInTheDocument(),
    );
    expect(callCount).toBe(2);
  });

  it("passes period and metric changes through to the graph service", async () => {
    const graphService: GraphQueryService = {
      getGraphData: async (params) => ({
        period: params.period,
        metric: params.metric,
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
      }),
    };

    render(<GraphPage accountId="local-account" graphService={graphService} />);

    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "1件のusageSeconds推移グラフ" }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "週" }));
    fireEvent.click(screen.getByRole("button", { name: "獲得額" }));

    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "1件のearnedYen推移グラフ" }),
      ).toBeInTheDocument(),
    );
    expect(
      within(screen.getByRole("table")).getByText("1,000円"),
    ).toBeInTheDocument();
  });
});
