import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { useActivityStore } from "./stores/useActivityStore";
import { useNavigationStore } from "./stores/useNavigationStore";
import { useResultFlowStore } from "./stores/useResultFlowStore";

vi.mock("@tauri-apps/plugin-autostart", () => ({
  disable: vi.fn(),
  enable: vi.fn(),
  isEnabled: vi.fn().mockResolvedValue(false),
}));

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

  it.each(["カレンダー", "グラフ", "設定"])(
    "shows %s after clicking its navigation button",
    async (pageName) => {
      const user = userEvent.setup();
      render(<App />);

      const navigationButton = screen.getByRole("button", {
        name: new RegExp(pageName),
      });
      await user.click(navigationButton);

      expect(
        screen.getByRole("heading", { level: 2, name: pageName }),
      ).toBeInTheDocument();
      expect(navigationButton).toHaveAttribute("aria-current", "page");
    },
  );

  it("switches pages with keyboard operation", async () => {
    const user = userEvent.setup();
    render(<App />);

    const graphButton = screen.getByRole("button", { name: /グラフ/ });
    graphButton.focus();
    await user.keyboard("{Enter}");

    expect(
      screen.getByRole("heading", { level: 2, name: "グラフ" }),
    ).toBeInTheDocument();
    expect(graphButton).toHaveAttribute("aria-current", "page");
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
