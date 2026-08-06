import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { useActivityStore } from "./stores/useActivityStore";
import { useNavigationStore } from "./stores/useNavigationStore";
import { useResultFlowStore } from "./stores/useResultFlowStore";

describe("App navigation", () => {
  beforeEach(() => {
    useNavigationStore.setState({ currentPage: "timer" });
    useActivityStore.setState({
      elapsedSeconds: 0,
      startedAt: null,
      sessionId: null,
      measurementStatus: "idle",
      stoppedMeasurement: null,
    });
    useResultFlowStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the timer page first", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { level: 2, name: "タイマー" }),
    ).toBeInTheDocument();
  });

  it("shows calendar after clicking its navigation button", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /カレンダー/ }));

    expect(
      screen.getByRole("heading", { level: 2, name: "カレンダー" }),
    ).toBeInTheDocument();
  });

  it("updates the displayed app usage time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    render(<App />);

    act(() => {
      vi.advanceTimersByTime(3_500);
    });

    expect(screen.getByText("00:00:03")).toBeInTheDocument();
  });

  it("opens the development result preview outside navigation and returns", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole("button", { name: "結果フローをプレビュー" }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "計測結果を確定" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("complementary", { name: "画面ナビゲーション" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "結果演出をすべてスキップ" }),
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "タイマー" }),
    ).toBeInTheDocument();
    expect(useResultFlowStore.getState().status).toBe("idle");
  });
});
