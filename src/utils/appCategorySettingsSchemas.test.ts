import { describe, expect, it } from "vitest";

import { appCategorySettingsSchema } from "./appCategorySettingsSchemas";

describe("appCategorySettingsSchema", () => {
  const validSettings = {
    schemaVersion: 1,
    desktopApps: [
      {
        appId: "code.exe",
        processName: "Code.exe",
        category: "productive",
      },
    ],
  } as const;

  it("accepts canonical category settings", () => {
    expect(appCategorySettingsSchema.parse(validSettings)).toEqual(validSettings);
  });

  it("rejects unknown categories, non-canonical names, duplicates, and fields", () => {
    expect(
      appCategorySettingsSchema.safeParse({
        ...validSettings,
        desktopApps: [
          ...validSettings.desktopApps,
          { appId: "code.exe", processName: "code.exe", category: "waste" },
        ],
      }).success,
    ).toBe(false);
    expect(
      appCategorySettingsSchema.safeParse({
        ...validSettings,
        desktopApps: [
          { ...validSettings.desktopApps[0], category: "unknown" },
        ],
      }).success,
    ).toBe(false);
    expect(
      appCategorySettingsSchema.safeParse({
        ...validSettings,
        privateField: "nope",
      }).success,
    ).toBe(false);
  });
});
