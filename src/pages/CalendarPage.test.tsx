import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CalendarPage } from "./CalendarPage";

describe("CalendarPage", () => {
  it("renders the graph demo data as a monthly calendar", () => {
    render(<CalendarPage />);

    expect(screen.getByRole("heading", { name: "2026年 8月" })).toBeInTheDocument();
    expect(screen.getByLabelText("2026年8月の合計")).toHaveTextContent("16時間10分");
    expect(screen.getByLabelText(/8月9日、利用時間2時間10分/)).toBeInTheDocument();
    expect(screen.getByText("+￥33,500")).toBeInTheDocument();
  });

  it("shows the selected day and an empty state", () => {
    render(<CalendarPage />);

    fireEvent.click(screen.getByLabelText(/8月3日、利用時間2時間/));
    expect(screen.getByText("8月3日")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2時間" })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("8月1日、記録なし"));
    expect(screen.getByRole("heading", { name: "記録なし" })).toBeInTheDocument();
  });
});
