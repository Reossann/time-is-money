import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../services/graphDemoData", () => ({
  DEMO_GRAPH_POINTS: {
    day: [{
      dateKey: "2026-08-09",
      label: "8/9",
      usageSeconds: 60,
      earnedYen: 0,
      wastedYen: 1_000,
      netYen: -1_000,
    }],
    week: [],
    month: [],
  },
}));

import { CalendarPage } from "./CalendarPage";

describe("CalendarPage net amount", () => {
  it("shows a negative net amount without a contradictory plus sign", () => {
    const { container } = render(<CalendarPage />);

    const netValues = [
      ...[...container.querySelectorAll(".demo-calendar__net")].map((element) => element.textContent),
      container.querySelector(".demo-calendar__detail-net dd")?.textContent,
    ];
    expect(netValues).toEqual([
      "-￥1,000",
      "-￥1,000",
      "-￥1,000",
    ]);
    expect(screen.queryByText("+￥-1,000")).not.toBeInTheDocument();
  });
});
