import { describe, expect, it } from "vitest";

import { evaluateConfiguredAppUsageLimits } from "./appUsageLimitNotificationService";
import { createInitialAppUsageLimitState } from "./appUsageLimitStateService";

const setting = {
  appId: "editor",
  processName: "Editor.exe",
  dailyLimitSeconds: 60 * 60,
  continuousLimitSeconds: 30 * 60,
  cooldownSeconds: 900,
  enabled: true,
} as const;

const settings = { schemaVersion: 1 as const, desktopApps: [setting] };

describe("evaluateConfiguredAppUsageLimits", () => {
  it("evaluates both daily and continuous limits for enabled apps", () => {
    const previous = createInitialAppUsageLimitState({ localDate: "2026-08-09", capturedAt: 0, appId: "editor" });
    const current = { ...previous, lastCapturedAt: 1, continuousSeconds: 30 * 60, dailySecondsByAppId: { editor: 60 * 60 } };
    const result = evaluateConfiguredAppUsageLimits(previous, current, settings);
    expect(result.events.filter((event) => event.notification === "reached").map((event) => event.kind)).toEqual(["daily", "continuous"]);
  });

  it("does not repeat an already emitted notification", () => {
    const previous = createInitialAppUsageLimitState({ localDate: "2026-08-09", capturedAt: 0, appId: "editor" });
    const current = { ...previous, lastCapturedAt: 1, continuousSeconds: 30 * 60, dailySecondsByAppId: { editor: 60 * 60 } };
    const first = evaluateConfiguredAppUsageLimits(previous, current, settings);
    const second = evaluateConfiguredAppUsageLimits(previous, current, settings, first.notifiedKeys);
    expect(second.events).toEqual([]);
  });

  it("ignores disabled rules and resets keys on a date change", () => {
    const previous = createInitialAppUsageLimitState({ localDate: "2026-08-09", capturedAt: 0, appId: "editor" });
    const current = { ...previous, localDate: "2026-08-10", dailySecondsByAppId: { editor: 60 * 60 } };
    const disabled = { ...settings, desktopApps: [{ ...setting, enabled: false }] };
    expect(evaluateConfiguredAppUsageLimits(previous, current, disabled, new Set(["editor:daily:reached"])).events).toEqual([]);
    expect(evaluateConfiguredAppUsageLimits(previous, current, settings, new Set(["editor:daily:reached"])).events).toHaveLength(3);
  });
});
