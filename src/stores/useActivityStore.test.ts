import { beforeEach, describe, expect, it, vi } from "vitest";

import { MeasurementLifecycleError } from "../services/sessionResultService";
import { useActivityStore } from "./useActivityStore";

const SESSION_ID = "00000000-0000-4000-8000-000000000001";

describe("useActivityStore", () => {
  beforeEach(() => {
    useActivityStore.setState({
      elapsedSeconds: 0,
      startedAt: null,
      sessionId: null,
    measurementStatus: "idle",
    stoppedMeasurement: null,
    finalizedResult: null,
    finalizationErrorCode: null,
    });
  });

  it("measures elapsed time from the start timestamp", () => {
    const { startMeasurement, syncElapsed } = useActivityStore.getState();

    startMeasurement(1_000, () => SESSION_ID);
    syncElapsed(11_900);

    expect(useActivityStore.getState().elapsedSeconds).toBe(10);
  });

  it("does not update before measurement starts", () => {
    useActivityStore.getState().syncElapsed(5_000);

    expect(useActivityStore.getState().elapsedSeconds).toBe(0);
  });

  it("does not expose a negative elapsed time", () => {
    const { startMeasurement, syncElapsed } = useActivityStore.getState();

    startMeasurement(5_000, () => SESSION_ID);
    syncElapsed(1_000);

    expect(useActivityStore.getState().elapsedSeconds).toBe(0);
  });

  it("keeps the same session when start is called twice", () => {
    const generateFirstId = vi.fn(() => SESSION_ID);
    const generateSecondId = vi.fn(
      () => "00000000-0000-4000-8000-000000000002",
    );
    const { startMeasurement } = useActivityStore.getState();

    const firstMeasurement = startMeasurement(1_000, generateFirstId);
    const secondMeasurement = startMeasurement(9_000, generateSecondId);

    expect(secondMeasurement).toEqual(firstMeasurement);
    expect(useActivityStore.getState()).toMatchObject({
      measurementStatus: "running",
      sessionId: SESSION_ID,
      startedAt: 1_000,
    });
    expect(generateFirstId).toHaveBeenCalledOnce();
    expect(generateSecondId).not.toHaveBeenCalled();
  });

  it("fixes the first stop snapshot and returns it for later stops", () => {
    const { startMeasurement, stopMeasurement, syncElapsed } =
      useActivityStore.getState();
    startMeasurement(1_000, () => SESSION_ID);

    const firstStop = stopMeasurement(3_900);
    syncElapsed(20_000);
    const secondStop = stopMeasurement(50_000);

    expect(firstStop).toEqual({
      sessionId: SESSION_ID,
      startedAt: 1_000,
      endedAt: 3_900,
      durationSeconds: 2,
    });
    expect(secondStop).toBe(firstStop);
    expect(Object.isFrozen(firstStop)).toBe(true);
    expect(useActivityStore.getState()).toMatchObject({
      elapsedSeconds: 2,
      measurementStatus: "stopped",
      stoppedMeasurement: firstStop,
    });
  });

  it("rejects stop before start", () => {
    expect(() => useActivityStore.getState().stopMeasurement(1_000)).toThrow(
      expect.objectContaining({
        code: "MEASUREMENT_NOT_RUNNING",
      }),
    );
  });

  it("keeps running when the stop timestamp is earlier than startedAt", () => {
    const { startMeasurement, stopMeasurement } = useActivityStore.getState();
    startMeasurement(5_000, () => SESSION_ID);

    expect(() => stopMeasurement(4_999)).toThrow(
      expect.objectContaining({ code: "END_BEFORE_START" }),
    );
    expect(useActivityStore.getState()).toMatchObject({
      measurementStatus: "running",
      sessionId: SESSION_ID,
      startedAt: 5_000,
      stoppedMeasurement: null,
    });
  });

  it("does not replace a stopped snapshot with a new measurement", () => {
    const { startMeasurement, stopMeasurement } = useActivityStore.getState();
    startMeasurement(1_000, () => SESSION_ID);
    const stoppedMeasurement = stopMeasurement(2_000);

    expect(() =>
      startMeasurement(3_000, () => "replacement-session"),
    ).toThrow(MeasurementLifecycleError);
    expect(useActivityStore.getState().stoppedMeasurement).toBe(
      stoppedMeasurement,
    );
  });
});
