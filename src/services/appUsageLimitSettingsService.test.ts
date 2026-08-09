import { describe, expect, it } from "vitest";

import { replaceAppUsageLimit } from "./appUsageLimitSettingsService";

const chrome = {
  appId: "chrome.exe",
  processName: "chrome.exe",
  dailyLimitSeconds: 60 * 60,
  continuousLimitSeconds: 30 * 60,
  cooldownSeconds: 15 * 60,
  enabled: true,
} as const;

describe("replaceAppUsageLimit", () => {
  it("replaces the original rule when its process name changes", () => {
    const result = replaceAppUsageLimit(
      chrome.appId,
      { ...chrome, processName: "msedge.exe" },
      { schemaVersion: 1, desktopApps: [chrome] },
    );

    expect(result.desktopApps).toEqual([
      expect.objectContaining({ appId: "msedge.exe", processName: "msedge.exe" }),
    ]);
  });

  it("rejects changing a rule into another configured process", () => {
    const edge = { ...chrome, appId: "msedge.exe", processName: "msedge.exe" };

    expect(() => replaceAppUsageLimit(
      chrome.appId,
      { ...chrome, processName: edge.processName },
      { schemaVersion: 1, desktopApps: [chrome, edge] },
    )).toThrow("already exists");
  });
});
