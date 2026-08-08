import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import {
  getAppUsageTrackingSnapshot,
  startAppUsageTracking,
  stopAppUsageTracking,
} from "./services/appUsageTrackingService";
import { resetMeasurementTrackingControllerForTests } from "./hooks/useMeasurementTracking";
import { useActivityStore } from "./stores/useActivityStore";
import { useNavigationStore } from "./stores/useNavigationStore";
import { useResultFlowStore } from "./stores/useResultFlowStore";

vi.mock("@tauri-apps/plugin-autostart", () => ({
  disable: vi.fn(),
  enable: vi.fn(),
  isEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock("./services/appUsageTrackingService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("./services/appUsageTrackingService")
  >();
  return {
    ...actual,
    startAppUsageTracking: vi.fn(),
    getAppUsageTrackingSnapshot: vi.fn(),
    stopAppUsageTracking: vi.fn(),
  };
});

const startTrackingMock = vi.mocked(startAppUsageTracking);
const getSnapshotMock = vi.mocked(getAppUsageTrackingSnapshot);
const stopTrackingMock = vi.mocked(stopAppUsageTracking);
const SESSION_ID = "00000000-0000-4000-8000-000000000001";

describe("App navigation", () => {
  beforeEach(() => {
    resetMeasurementTrackingControllerForTests();
    useNavigationStore.setState({ currentPage: "timer" });
    useActivityStore.setState({
      elapsedSeconds: 0,
      startedAt: null,
      sessionId: null,
      measurementStatus: "idle",
      stoppedMeasurement: null,
    });
    useResultFlowStore.getState().reset();
    startTrackingMock.mockReset().mockResolvedValue(undefined);
    getSnapshotMock.mockReset().mockResolvedValue({
      schemaVersion: 1,
      sessionId: SESSION_ID,
      startedAt: 0,
      capturedAt: 0,
      durationSeconds: 0,
      trackedDurationSeconds: 0,
      untrackedDurationSeconds: 0,
      apps: [],
    });
    stopTrackingMock.mockReset();
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(SESSION_ID);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows the timer page first", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { level: 2, name: "タイマー" }),
    ).toBeInTheDocument();
  });

  it("starts app usage tracking once under StrictMode", async () => {
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    await waitFor(() => expect(startTrackingMock).toHaveBeenCalledOnce());
    expect(startTrackingMock).toHaveBeenCalledWith(
      SESSION_ID,
      expect.any(Number),
    );
  });

  it("keeps the same tracker while navigating away from and back to the timer", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(startTrackingMock).toHaveBeenCalledOnce());

    await user.click(screen.getByRole("button", { name: /カレンダー/ }));
    await user.click(screen.getByRole("button", { name: /タイマー/ }));

    expect(startTrackingMock).toHaveBeenCalledOnce();
    expect(stopTrackingMock).not.toHaveBeenCalled();
    expect(useActivityStore.getState()).toMatchObject({
      measurementStatus: "running",
      sessionId: SESSION_ID,
    });
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
