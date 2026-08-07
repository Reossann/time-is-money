import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getAppUsageTrackingSnapshot,
  startAppUsageTracking,
  stopAppUsageTracking,
} from "../services/appUsageTrackingService";
import { useActivityStore } from "../stores/useActivityStore";
import type { AppUsageSnapshot } from "../types/appUsageTracking";
import {
  ensureMeasurementTrackingStarted,
  getMeasurementTrackingState,
  refreshAppUsageTrackingSnapshot,
  resetMeasurementTrackingControllerForTests,
  stopAndSnapshotAppUsage,
  useMeasurementTracking,
} from "./useMeasurementTracking";

vi.mock("../services/appUsageTrackingService", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../services/appUsageTrackingService")
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

const snapshot: AppUsageSnapshot = Object.freeze({
  schemaVersion: 1,
  sessionId: SESSION_ID,
  startedAt: 1_000,
  capturedAt: 4_000,
  durationSeconds: 3,
  trackedDurationSeconds: 2,
  untrackedDurationSeconds: 1,
  apps: Object.freeze([
    Object.freeze({
      appId: "code.exe",
      processName: "Code.exe",
      durationSeconds: 2,
    }),
  ]),
});

const previewSnapshot: AppUsageSnapshot = Object.freeze({
  ...snapshot,
  capturedAt: 3_000,
  durationSeconds: 2,
  trackedDurationSeconds: 1,
  untrackedDurationSeconds: 1,
  apps: Object.freeze([
    Object.freeze({
      appId: "code.exe",
      processName: "Code.exe",
      durationSeconds: 1,
    }),
  ]),
});

function resetActivityStore(): void {
  useActivityStore.setState({
    elapsedSeconds: 0,
    startedAt: null,
    sessionId: null,
    measurementStatus: "idle",
    stoppedMeasurement: null,
  });
}

function TrackingHarness() {
  const state = useMeasurementTracking();
  return <span>{state.status}</span>;
}

describe("useMeasurementTracking", () => {
  beforeEach(() => {
    resetActivityStore();
    resetMeasurementTrackingControllerForTests();
    startTrackingMock.mockReset().mockResolvedValue(undefined);
    getSnapshotMock.mockReset().mockResolvedValue(snapshot);
    stopTrackingMock.mockReset().mockResolvedValue(snapshot);
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(SESSION_ID);
    vi.spyOn(Date, "now").mockReturnValue(1_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts one frontend measurement and one Rust tracker in StrictMode", async () => {
    const { unmount } = render(
      <StrictMode>
        <TrackingHarness />
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByText("tracking")).toBeInTheDocument());

    expect(startTrackingMock).toHaveBeenCalledOnce();
    expect(startTrackingMock).toHaveBeenCalledWith(
      SESSION_ID,
      expect.any(Number),
    );
    expect(useActivityStore.getState()).toMatchObject({
      measurementStatus: "running",
      sessionId: SESSION_ID,
    });

    unmount();
    expect(stopTrackingMock).not.toHaveBeenCalled();
    expect(getMeasurementTrackingState().status).toBe("tracking");
  });

  it("keeps a safe start error while the frontend measurement remains identifiable", async () => {
    startTrackingMock.mockRejectedValue({ code: "TRACKING_ALREADY_RUNNING" });

    render(<TrackingHarness />);

    await waitFor(() =>
      expect(screen.getByText("start-failed")).toBeInTheDocument(),
    );
    expect(getMeasurementTrackingState()).toMatchObject({
      status: "start-failed",
      snapshot: null,
      errorCode: "TRACKING_ALREADY_RUNNING",
    });
    expect(useActivityStore.getState()).toMatchObject({
      measurementStatus: "running",
      sessionId: SESSION_ID,
    });
  });

  it("shares an in-flight preview request", async () => {
    await ensureMeasurementTrackingStarted();
    let resolveSnapshot: ((value: AppUsageSnapshot) => void) | undefined;
    getSnapshotMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSnapshot = resolve;
      }),
    );

    const first = refreshAppUsageTrackingSnapshot(4_000);
    const second = refreshAppUsageTrackingSnapshot(9_000);
    await Promise.resolve();

    expect(second).toBe(first);
    expect(getSnapshotMock).toHaveBeenCalledOnce();
    resolveSnapshot?.(snapshot);
    await expect(first).resolves.toBe(snapshot);
    expect(getMeasurementTrackingState()).toMatchObject({
      status: "tracking",
      snapshot,
      errorCode: null,
    });
  });

  it("shares a stop request and retries with the first stopped boundary", async () => {
    await ensureMeasurementTrackingStarted();
    let rejectStop: ((reason: unknown) => void) | undefined;
    stopTrackingMock.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectStop = reject;
      }),
    );

    const first = stopAndSnapshotAppUsage(4_000);
    const duplicate = stopAndSnapshotAppUsage(9_000);
    await Promise.resolve();

    expect(duplicate).toBe(first);
    expect(stopTrackingMock).toHaveBeenCalledOnce();
    rejectStop?.({ code: "INTERNAL" });
    await expect(first).rejects.toEqual({ code: "INTERNAL" });
    expect(useActivityStore.getState().stoppedMeasurement?.endedAt).toBe(4_000);
    expect(getMeasurementTrackingState()).toMatchObject({
      status: "stop-failed",
      errorCode: "INTERNAL",
    });

    stopTrackingMock.mockResolvedValueOnce(snapshot);
    const retry = stopAndSnapshotAppUsage(20_000);
    await expect(retry).resolves.toBe(snapshot);
    expect(stopTrackingMock).toHaveBeenNthCalledWith(2, SESSION_ID, 4_000);
    expect(getMeasurementTrackingState()).toMatchObject({
      status: "stopped",
      snapshot,
      errorCode: null,
    });
  });

  it("keeps the final snapshot when an earlier preview resolves after stop", async () => {
    await ensureMeasurementTrackingStarted();
    let resolvePreview: ((value: AppUsageSnapshot) => void) | undefined;
    getSnapshotMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePreview = resolve;
      }),
    );

    const preview = refreshAppUsageTrackingSnapshot(3_000);
    await Promise.resolve();
    const stopped = stopAndSnapshotAppUsage(4_000);
    await expect(stopped).resolves.toBe(snapshot);

    resolvePreview?.(previewSnapshot);
    await expect(preview).resolves.toBe(previewSnapshot);
    expect(getMeasurementTrackingState()).toEqual({
      status: "stopped",
      snapshot,
      errorCode: null,
    });
  });
});
