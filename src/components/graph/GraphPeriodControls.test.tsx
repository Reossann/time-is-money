import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GraphPeriodControls } from "./GraphPeriodControls";

describe("GraphPeriodControls", () => {
  it("marks the selected period and exposes the group label", () => {
    render(<GraphPeriodControls value="day" onChange={vi.fn()} />);

    expect(screen.getByRole("group", { name: "表示期間" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "日" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "週" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("calls onChange with the selected period", () => {
    const onChange = vi.fn();
    render(<GraphPeriodControls value="day" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "週" }));
    fireEvent.click(screen.getByRole("button", { name: "月" }));

    expect(onChange).toHaveBeenNthCalledWith(1, "week");
    expect(onChange).toHaveBeenNthCalledWith(2, "month");
  });
});
