import { beforeEach, describe, expect, it } from "vitest";

import { useActivityStore } from "./useActivityStore";

describe("useActivityStore", () => {
  beforeEach(() => {
    useActivityStore.setState({ elapsedSeconds: 0, startedAt: null });
  });

  it("measures elapsed time from the start timestamp", () => {
    const { startMeasurement, syncElapsed } = useActivityStore.getState();

    startMeasurement(1_000);
    syncElapsed(11_900);

    expect(useActivityStore.getState().elapsedSeconds).toBe(10);
  });

  it("does not update before measurement starts", () => {
    useActivityStore.getState().syncElapsed(5_000);

    expect(useActivityStore.getState().elapsedSeconds).toBe(0);
  });

  it("does not expose a negative elapsed time", () => {
    const { startMeasurement, syncElapsed } = useActivityStore.getState();

    startMeasurement(5_000);
    syncElapsed(1_000);

    expect(useActivityStore.getState().elapsedSeconds).toBe(0);
  });
});
