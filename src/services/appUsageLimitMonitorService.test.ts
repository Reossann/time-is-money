import { describe, expect, it, vi } from "vitest";

import { processAppUsageLimitObservation } from "./appUsageLimitMonitorService";
import { createInitialAppUsageLimitState } from "./appUsageLimitStateService";

const setting = { appId: "editor", processName: "Editor.exe", dailyLimitSeconds: 60, continuousLimitSeconds: 60, cooldownSeconds: 900, enabled: true } as const;
const settings = { schemaVersion: 1 as const, desktopApps: [setting] };

describe("processAppUsageLimitObservation", () => {
  it("updates state and sends each newly crossed event", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const previous = createInitialAppUsageLimitState({ localDate: "2026-08-09", capturedAt: 0, appId: "editor" });
    const result = await processAppUsageLimitObservation(previous, { localDate: "2026-08-09", capturedAt: 60_000, appId: "editor" }, settings, {}, send);
    expect(result.sentCount).toBe(2);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("records delivery timestamps and suppresses the same events on the next sample", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const previous = createInitialAppUsageLimitState({ localDate: "2026-08-09", capturedAt: 0, appId: "editor" });
    const first = await processAppUsageLimitObservation(previous, { localDate: "2026-08-09", capturedAt: 60_000, appId: "editor" }, settings, {}, send);
    const second = await processAppUsageLimitObservation(first.state, { localDate: "2026-08-09", capturedAt: 61_000, appId: "editor" }, settings, first.deliveryState, send);
    expect(second.sentCount).toBe(0);
  });

  it("does not resend a reached notification after its cooldown when no new boundary was crossed", async () => {
    const hourlySetting = { ...setting, dailyLimitSeconds: 60 * 60, continuousLimitSeconds: 60 * 60, cooldownSeconds: 1 };
    const hourlySettings = { schemaVersion: 1 as const, desktopApps: [hourlySetting] };
    const send = vi.fn().mockResolvedValue(undefined);
    const previous = createInitialAppUsageLimitState({ localDate: "2026-08-09", capturedAt: 0, appId: "editor" });
    const first = await processAppUsageLimitObservation(previous, { localDate: "2026-08-09", capturedAt: 3_600_000, appId: "editor" }, hourlySettings, {}, send);
    const second = await processAppUsageLimitObservation(first.state, { localDate: "2026-08-09", capturedAt: 3_601_000, appId: "editor" }, hourlySettings, first.deliveryState, send);
    expect(first.sentCount).toBe(6);
    expect(second.sentCount).toBe(0);
    expect(send).toHaveBeenCalledTimes(6);
  });

  it("keeps advanced state and successful delivery records when another notification fails", async () => {
    const send = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("notification unavailable"));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const previous = createInitialAppUsageLimitState({ localDate: "2026-08-09", capturedAt: 0, appId: "editor" });

    try {
      const result = await processAppUsageLimitObservation(previous, { localDate: "2026-08-09", capturedAt: 60_000, appId: "editor" }, settings, {}, send);
      expect(result.state.lastCapturedAt).toBe(60_000);
      expect(result.sentCount).toBe(1);
      expect(Object.keys(result.deliveryState)).toHaveLength(1);
    } finally {
      error.mockRestore();
    }
  });
});
