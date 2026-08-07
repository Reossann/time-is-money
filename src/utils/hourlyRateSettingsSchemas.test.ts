import { describe, expect, it } from "vitest";

import type { HourlyRateSettings } from "../types/hourlyRateSettings";
import {
  desktopAppHourlyRateSettingSchema,
  hourlyRateSettingsSchema,
  hourlyRateYenSchema,
} from "./hourlyRateSettingsSchemas";

const validSettings = {
  schemaVersion: 1,
  defaultHourlyRateYen: 3_000,
  desktopApps: [
    {
      appId: "code.exe",
      processName: "Code.exe",
      hourlyRateYen: null,
    },
    {
      appId: "notepad.exe",
      processName: "notepad.exe",
      hourlyRateYen: 1_234.5,
    },
  ],
} as const satisfies HourlyRateSettings;

describe("hourlyRateYenSchema", () => {
  it.each([0, 1_234.5, Number.MAX_VALUE])(
    "accepts non-negative finite rate %s",
    (hourlyRateYen) => {
      expect(hourlyRateYenSchema.safeParse(hourlyRateYen).success).toBe(true);
    },
  );

  it.each([
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    "3000",
    null,
  ])("rejects invalid rate %s", (hourlyRateYen) => {
    expect(hourlyRateYenSchema.safeParse(hourlyRateYen).success).toBe(false);
  });
});

describe("desktopAppHourlyRateSettingSchema", () => {
  it.each([null, 0, 1_234.5])("accepts override %s", (hourlyRateYen) => {
    expect(
      desktopAppHourlyRateSettingSchema.safeParse({
        appId: "code.exe",
        processName: "Code.exe",
        hourlyRateYen,
      }).success,
    ).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
    ["control character", "Code\u0000.exe"],
    ["forward-slash path", "C:/Apps/Code.exe"],
    ["backslash path", "C:\\Apps\\Code.exe"],
  ])("rejects %s processName", (_label, processName) => {
    expect(
      desktopAppHourlyRateSettingSchema.safeParse({
        appId: "code.exe",
        processName,
        hourlyRateYen: null,
      }).success,
    ).toBe(false);
  });

  it.each([" Code.exe", "Code.exe ", "Cafe\u0301.exe"])(
    "rejects non-canonical processName %s",
    (processName) => {
      expect(
        desktopAppHourlyRateSettingSchema.safeParse({
          appId: processName.trim().normalize("NFC").toLowerCase(),
          processName,
          hourlyRateYen: null,
        }).success,
      ).toBe(false);
    },
  );

  it("rejects an appId that does not match processName", () => {
    expect(
      desktopAppHourlyRateSettingSchema.safeParse({
        appId: "notepad.exe",
        processName: "Code.exe",
        hourlyRateYen: null,
      }).success,
    ).toBe(false);
  });

  it.each(["windowTitle", "processId", "fullPath"])(
    "rejects private extra field %s",
    (field) => {
      expect(
        desktopAppHourlyRateSettingSchema.safeParse({
          appId: "code.exe",
          processName: "Code.exe",
          hourlyRateYen: null,
          [field]: "private value",
        }).success,
      ).toBe(false);
    },
  );
});

describe("hourlyRateSettingsSchema", () => {
  it("accepts valid version 1 settings", () => {
    expect(hourlyRateSettingsSchema.parse(validSettings)).toEqual(validSettings);
  });

  it("rejects an unknown schema version", () => {
    expect(
      hourlyRateSettingsSchema.safeParse({ ...validSettings, schemaVersion: 2 })
        .success,
    ).toBe(false);
  });

  it("rejects missing and extra top-level fields", () => {
    const missingDefault = { ...validSettings } as Record<string, unknown>;
    Reflect.deleteProperty(missingDefault, "defaultHourlyRateYen");

    expect(hourlyRateSettingsSchema.safeParse(missingDefault).success).toBe(false);
    expect(
      hourlyRateSettingsSchema.safeParse({
        ...validSettings,
        windowTitle: "private title",
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate app IDs", () => {
    expect(
      hourlyRateSettingsSchema.safeParse({
        ...validSettings,
        desktopApps: [
          validSettings.desktopApps[0],
          {
            appId: "code.exe",
            processName: "CODE.EXE",
            hourlyRateYen: 0,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid default rate %s",
    (defaultHourlyRateYen) => {
      expect(
        hourlyRateSettingsSchema.safeParse({
          ...validSettings,
          defaultHourlyRateYen,
        }).success,
      ).toBe(false);
    },
  );
});
