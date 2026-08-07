import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  refreshAppUsageTrackingSnapshot,
  useMeasurementTrackingState,
} from "../../hooks/useMeasurementTracking";
import { AppUsageTrackingDiagnostics } from "./AppUsageTrackingDiagnostics";

vi.mock("../../hooks/useMeasurementTracking", () => ({
  refreshAppUsageTrackingSnapshot: vi.fn(),
  useMeasurementTrackingState: vi.fn(),
}));

const refreshMock = vi.mocked(refreshAppUsageTrackingSnapshot);
const useTrackingStateMock = vi.mocked(useMeasurementTrackingState);

describe("AppUsageTrackingDiagnostics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refreshMock.mockReset().mockResolvedValue({
      schemaVersion: 1,
      sessionId: "session-a",
      startedAt: 1_000,
      capturedAt: 4_000,
      durationSeconds: 3,
      trackedDurationSeconds: 2,
      untrackedDurationSeconds: 1,
      apps: [],
    });
    useTrackingStateMock.mockReturnValue({
      status: "tracking",
      errorCode: null,
      snapshot: {
        schemaVersion: 1,
        sessionId: "session-a",
        startedAt: 1_000,
        capturedAt: 4_000,
        durationSeconds: 3,
        trackedDurationSeconds: 2,
        untrackedDurationSeconds: 1,
        apps: [
          {
            appId: "code.exe",
            processName: "Code.exe",
            durationSeconds: 2,
          },
        ],
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows only public app usage fields and refreshes while mounted", () => {
    const { unmount } = render(<AppUsageTrackingDiagnostics />);

    expect(screen.getByText("計測中")).toBeInTheDocument();
    expect(screen.getByText("Code.exe")).toBeInTheDocument();
    expect(screen.getAllByText("2秒")).toHaveLength(2);
    expect(screen.getByText("1秒")).toBeInTheDocument();
    expect(screen.queryByText(/windowTitle|processId|fullPath|https?:/)).toBeNull();
    expect(refreshMock).toHaveBeenCalledOnce();

    act(() => vi.advanceTimersByTime(2_000));
    expect(refreshMock).toHaveBeenCalledTimes(3);

    unmount();
    act(() => vi.advanceTimersByTime(2_000));
    expect(refreshMock).toHaveBeenCalledTimes(3);
  });

  it("renders only the allow-listed error code", () => {
    useTrackingStateMock.mockReturnValue({
      status: "start-failed",
      snapshot: null,
      errorCode: "SESSION_MISMATCH",
    });

    render(<AppUsageTrackingDiagnostics />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "エラーコード: SESSION_MISMATCH",
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
