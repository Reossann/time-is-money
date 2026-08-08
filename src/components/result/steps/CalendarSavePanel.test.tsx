import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CalendarSavePanel } from "./CalendarSavePanel";

const noop = () => {};

describe("CalendarSavePanel", () => {
  it("shows the saving status without any controls", () => {
    render(
      <CalendarSavePanel
        status="saving"
        errorCode={null}
        onRetry={noop}
        onUndo={noop}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "計測結果を保存しています",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers an undo control after a successful save", () => {
    const onUndo = vi.fn();
    render(
      <CalendarSavePanel
        status="saved"
        errorCode={null}
        onRetry={noop}
        onUndo={onUndo}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "この記録を取り消す" }),
    );
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("shows an error message and retry control on failure", () => {
    const onRetry = vi.fn();
    render(
      <CalendarSavePanel
        status="failed"
        errorCode="SAVE_FAILED"
        onRetry={onRetry}
        onUndo={noop}
      />,
    );

    expect(
      screen.getByText("保存に失敗しました。もう一度お試しください。"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "もう一度保存する" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("uses a generic message when no error code is present", () => {
    const { container } = render(
      <CalendarSavePanel
        status="failed"
        errorCode={null}
        onRetry={noop}
        onUndo={noop}
      />,
    );

    const errorParagraph = container.querySelector(".calendar-save__error");
    expect(errorParagraph).toHaveTextContent("計測結果を保存できませんでした。");
    expect(
      screen.getByRole("button", { name: "もう一度保存する" }),
    ).toBeInTheDocument();
  });
});
