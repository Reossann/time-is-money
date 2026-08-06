import { describe, expect, it } from "vitest";

import {
  createRunningMeasurement,
  createStoppedMeasurement,
} from "./sessionResultService";

const SESSION_ID = "00000000-0000-4000-8000-000000000001";

describe("sessionResultService", () => {
  it("creates immutable running and stopped measurements", () => {
    const runningMeasurement = createRunningMeasurement(
      1_000,
      () => SESSION_ID,
    );
    const stoppedMeasurement = createStoppedMeasurement(
      runningMeasurement,
      2_999,
    );

    expect(runningMeasurement).toEqual({
      sessionId: SESSION_ID,
      startedAt: 1_000,
    });
    expect(stoppedMeasurement).toEqual({
      sessionId: SESSION_ID,
      startedAt: 1_000,
      endedAt: 2_999,
      durationSeconds: 1,
    });
    expect(Object.isFrozen(runningMeasurement)).toBe(true);
    expect(Object.isFrozen(stoppedMeasurement)).toBe(true);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid start timestamp %s",
    (startedAt) => {
      expect(() =>
        createRunningMeasurement(startedAt, () => SESSION_ID),
      ).toThrow(expect.objectContaining({ code: "INVALID_TIMESTAMP" }));
    },
  );

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid stop timestamp %s",
    (endedAt) => {
      const runningMeasurement = createRunningMeasurement(
        1_000,
        () => SESSION_ID,
      );

      expect(() =>
        createStoppedMeasurement(runningMeasurement, endedAt),
      ).toThrow(expect.objectContaining({ code: "INVALID_TIMESTAMP" }));
    },
  );

  it("rejects an empty generated session ID", () => {
    expect(() => createRunningMeasurement(1_000, () => "  ")).toThrow(
      expect.objectContaining({ code: "INVALID_SESSION_ID" }),
    );
  });
});
