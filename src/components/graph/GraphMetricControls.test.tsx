import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GraphMetricControls } from "./GraphMetricControls";

describe("GraphMetricControls", () => {
  it("marks the selected metric", () => {
    render(<GraphMetricControls value="usageSeconds" onChange={vi.fn()} />);

    expect(screen.getByRole("group", { name: "表示指標" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "利用時間" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "獲得額" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("calls onChange with each selected metric", () => {
    const onChange = vi.fn();
    render(<GraphMetricControls value="usageSeconds" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "獲得額" }));
    fireEvent.click(screen.getByRole("button", { name: "浪費額" }));
    fireEvent.click(screen.getByRole("button", { name: "純増減" }));

    expect(onChange).toHaveBeenNthCalledWith(1, "earnedYen");
    expect(onChange).toHaveBeenNthCalledWith(2, "wastedYen");
    expect(onChange).toHaveBeenNthCalledWith(3, "netYen");
  });
});
