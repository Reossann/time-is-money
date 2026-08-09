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
});
