import { describe, expect, it } from "vitest";

import {
  createAppCategoryMap,
  createDefaultAppCategorySettings,
  removeAppCategory,
  setAppCategory,
} from "./appCategorySettingsService";

describe("appCategorySettingsService", () => {
  it("upserts normalized app categories, keeps deterministic order, and freezes output", () => {
    const withCode = setAppCategory(
      " Code.exe ",
      "productive",
      createDefaultAppCategorySettings(),
    );
    const settings = setAppCategory("chrome.exe", "waste", withCode);
    const updated = setAppCategory("CODE.EXE", "neutral", settings);

    expect(updated.desktopApps).toEqual([
      { appId: "chrome.exe", processName: "chrome.exe", category: "waste" },
      { appId: "code.exe", processName: "CODE.EXE", category: "neutral" },
    ]);
    expect(Object.isFrozen(updated)).toBe(true);
    expect(Object.isFrozen(updated.desktopApps)).toBe(true);
    expect(Object.isFrozen(updated.desktopApps[0])).toBe(true);
  });

  it("removes a category and makes only configured apps available to finalization", () => {
    const settings = setAppCategory(
      "Code.exe",
      "productive",
      setAppCategory(
        "Chrome.exe",
        "waste",
        createDefaultAppCategorySettings(),
      ),
    );
    const withoutChrome = removeAppCategory("chrome.exe", settings);

    expect([...createAppCategoryMap(withoutChrome)]).toEqual([
      ["code.exe", "productive"],
    ]);
  });
});
