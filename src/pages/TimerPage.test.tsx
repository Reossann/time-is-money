import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TimerPage } from "./TimerPage";
import { useActivityStore } from "../stores/useActivityStore";
import { useWebAppStore } from "../stores/useWebAppStore";
import { resetMeasurementTrackingControllerForTests } from "../hooks/useMeasurementTracking";

describe("TimerPage", () => {
  beforeEach(() => {
    vi.useRealTimers();
    resetMeasurementTrackingControllerForTests();
    useActivityStore.setState({ elapsedSeconds: 0, startedAt: null });
    useWebAppStore.setState({
      currentSession: null,
      usageStats: [],
      webApps: [],
      nativeBridgeStatus: "waiting",
      lastNativeEventAt: null,
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a formatter error without triggering a render loop", () => {
    useActivityStore.setState({ elapsedSeconds: -1 });

    render(<TimerPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "入力値は 0 以上である必要があります",
    );
  });

  it("shows the live duration in site usage statistics", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_005_000);
    useWebAppStore.setState({
      currentSession: {
        id: "session-1",
        webAppId: "google-docs",
        webAppName: "Google Docs",
        startedAt: 1_700_000_000_000,
        endedAt: null,
        durationSeconds: 0,
      },
      usageStats: [
        {
          webAppId: "google-docs",
          webAppName: "Google Docs",
          cumulativeSeconds: 3,
          sessionCount: 1,
        },
      ],
      nativeBridgeStatus: "connected",
    });

    render(<TimerPage />);

    expect(screen.getAllByText("Google Docs")).toHaveLength(1);
    expect(screen.getByText("00:00:08")).toBeInTheDocument();
    expect(screen.getByText("接続済み")).toBeInTheDocument();
  });

  it("updates the active duration every second", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    useWebAppStore.setState({
      currentSession: {
        id: "session-1",
        webAppId: "github",
        webAppName: "GitHub",
        startedAt: 1_700_000_000_000,
        endedAt: null,
        durationSeconds: 0,
      },
      usageStats: [
        {
          webAppId: "github",
          webAppName: "GitHub",
          cumulativeSeconds: 0,
          sessionCount: 1,
        },
      ],
    });

    render(<TimerPage />);
    expect(screen.getAllByText("00:00:00")).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    expect(screen.getAllByText("00:00:02")).toHaveLength(1);
  });

  it("shows the Windows app diagnostics in development", () => {
    render(<TimerPage />);

    expect(
      screen.getByRole("region", {
        name: "Windowsアプリ利用時間の開発診断",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "セッション結果の開発用確認" }),
    ).toBeInTheDocument();
  });
});
