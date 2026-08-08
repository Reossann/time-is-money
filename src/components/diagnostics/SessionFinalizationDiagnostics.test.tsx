import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionFinalization } from "../../hooks/useSessionFinalization";
import { SessionFinalizationDiagnostics } from "./SessionFinalizationDiagnostics";

vi.mock("../../hooks/useSessionFinalization", () => ({
  useSessionFinalization: vi.fn(),
}));

const useSessionFinalizationMock = vi.mocked(useSessionFinalization);

describe("SessionFinalizationDiagnostics", () => {
  const stopAndFinalizeMeasurement = vi.fn().mockResolvedValue(undefined);
  const retrySessionFinalization = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    stopAndFinalizeMeasurement.mockClear();
    retrySessionFinalization.mockClear();
    useSessionFinalizationMock.mockReturnValue({
      status: "finalized",
      result: {
        schemaVersion: 1,
        sessionId: "session-1",
        startedAt: 1_000,
        endedAt: 4_000,
        durationSeconds: 3,
        trackedDurationSeconds: 2,
        untrackedDurationSeconds: 1,
        apps: [
          {
            appId: "code.exe",
            processName: "Code.exe",
            durationSeconds: 2,
            category: "productive",
            hourlyRateYen: 1_200,
            money: { earnedYen: 1, wastedYen: 0, netYen: 1 },
          },
        ],
        totals: { earnedYen: 1, wastedYen: 0, netYen: 1 },
      },
      errorCode: null,
      getFinalizedSessionResult: vi.fn(),
      stopAndFinalizeMeasurement,
      retrySessionFinalization,
    });
  });

  it("shows only the allow-listed result summary", () => {
    render(<SessionFinalizationDiagnostics />);

    expect(screen.getByText("Code.exe")).toBeInTheDocument();
    expect(screen.getByText("生産的")).toBeInTheDocument();
    expect(screen.getByText("1,200円/時")).toBeInTheDocument();
    expect(screen.queryByText(/windowTitle|processId|fullPath|https?:/)).toBeNull();
    expect(screen.queryByText("session-1")).toBeNull();
  });

  it("stops while running and retries only after a safe failure", async () => {
    const user = userEvent.setup();
    useSessionFinalizationMock.mockReturnValue({
      status: "running",
      result: null,
      errorCode: null,
      getFinalizedSessionResult: vi.fn(),
      stopAndFinalizeMeasurement,
      retrySessionFinalization,
    });
    const { rerender } = render(<SessionFinalizationDiagnostics />);

    await user.click(screen.getByRole("button", { name: "停止して結果を確定" }));
    expect(stopAndFinalizeMeasurement).toHaveBeenCalledOnce();

    useSessionFinalizationMock.mockReturnValue({
      status: "failed",
      result: null,
      errorCode: "BUILD_FAILED",
      getFinalizedSessionResult: vi.fn(),
      stopAndFinalizeMeasurement,
      retrySessionFinalization,
    });
    rerender(<SessionFinalizationDiagnostics />);

    expect(screen.getByRole("alert")).toHaveTextContent("BUILD_FAILED");
    await user.click(screen.getByRole("button", { name: "結果の確定を再試行" }));
    expect(retrySessionFinalization).toHaveBeenCalledOnce();
  });
});
