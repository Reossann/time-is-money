import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { GraphData } from "../../types/graph";
import { GraphTable } from "./GraphTable";
import { TrendChart } from "./TrendChart";

const graphData: GraphData = {
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
    {
      dateKey: "2026-08-10",
      label: "8/10",
      usageSeconds: 1_800,
      earnedYen: 500,
      wastedYen: 300,
      netYen: 200,
    },
  ],
};

describe("TrendChart", () => {
  it("renders an accessible SVG and selected values", () => {
    render(<TrendChart data={graphData} />);

    expect(
      screen.getByRole("img", { name: "2件のnetYen推移グラフ" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByText("8/9")).toBeInTheDocument();
    expect(screen.getByText("8/10")).toBeInTheDocument();
    expect(screen.getByText("200円")).toBeInTheDocument();
    expect(screen.getByText("800円")).toBeInTheDocument();
  });

  it("renders an empty state without an SVG", () => {
    render(
      <TrendChart
        data={{ period: "day", metric: "usageSeconds", points: [] }}
      />,
    );

    expect(screen.getByText("この期間のデータはありません。")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows the selected period and value after click or keyboard selection", () => {
    render(<TrendChart data={graphData} />);

    const firstPoint = screen.getByRole("button", { name: "8/9: 800円" });
    fireEvent.click(firstPoint);

    expect(screen.getByRole("status")).toHaveTextContent(
      "選択中: 8/9 / 800円",
    );
    expect(firstPoint).toHaveAttribute("aria-pressed", "true");

    const secondPoint = screen.getByRole("button", { name: "8/10: 200円" });
    fireEvent.keyDown(secondPoint, { key: "Enter" });

    expect(screen.getByRole("status")).toHaveTextContent(
      "選択中: 8/10 / 200円",
    );
  });
});

describe("GraphTable", () => {
  it("renders the same selected values as the chart data", () => {
    render(<GraphTable data={graphData} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "8/9" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "8/10" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "値" })).toBeInTheDocument();
    expect(screen.getByText("800円")).toBeInTheDocument();
    expect(screen.getByText("200円")).toBeInTheDocument();
  });
});
