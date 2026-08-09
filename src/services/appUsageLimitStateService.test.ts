import { describe, expect, it } from "vitest";

import {
  advanceAppUsageLimitState,
  createInitialAppUsageLimitState,
} from "./appUsageLimitStateService";

describe("app usage limit state", () => {
  it("accumulates daily and continuous time for the active app", () => {
    const initial = createInitialAppUsageLimitState({ localDate: "2026-08-09", capturedAt: 0, appId: "editor" });
    const state = advanceAppUsageLimitState(initial, { localDate: "2026-08-09", capturedAt: 120_000, appId: "editor" });
    expect(state.continuousSeconds).toBe(120);
    expect(state.dailySecondsByAppId.editor).toBe(120);
  });

  it("resets continuous time when the foreground app changes", () => {
    const initial = createInitialAppUsageLimitState({ localDate: "2026-08-09", capturedAt: 0, appId: "editor" });
    const running = advanceAppUsageLimitState(initial, { localDate: "2026-08-09", capturedAt: 120_000, appId: "editor" });
    const switched = advanceAppUsageLimitState(running, { localDate: "2026-08-09", capturedAt: 180_000, appId: "browser" });
    expect(switched.continuousSeconds).toBe(0);
    expect(switched.dailySecondsByAppId.editor).toBe(180);
  });

  it("starts a new daily bucket after a local date change", () => {
    const initial = createInitialAppUsageLimitState({ localDate: "2026-08-09", capturedAt: 0, appId: "editor" });
    const state = advanceAppUsageLimitState(initial, { localDate: "2026-08-10", capturedAt: 86_400_000, appId: "editor" });
    expect(state.continuousSeconds).toBe(0);
    expect(state.dailySecondsByAppId).toEqual({});
  });

  it("ignores a timestamp that moves backwards", () => {
    const initial = createInitialAppUsageLimitState({ localDate: "2026-08-09", capturedAt: 10_000, appId: "editor" });
    expect(advanceAppUsageLimitState(initial, { localDate: "2026-08-09", capturedAt: 9_000, appId: "editor" })).toBe(initial);
  });
});
