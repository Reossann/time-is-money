import { describe, expect, it } from "vitest";

import type { HourlyRateSettings } from "../types/hourlyRateSettings";
import {
  clearAppHourlyRateYen,
  createDefaultHourlyRateSettings,
  normalizeDesktopAppId,
  registerDesktopApp,
  resolveHourlyRateYen,
  setAppHourlyRateYen,
  setDefaultHourlyRateYen,
} from "./hourlyRateSettingsService";

function createSettingsWithCode(): HourlyRateSettings {
  return registerDesktopApp(
    "Code.exe",
    setDefaultHourlyRateYen(3_000, createDefaultHourlyRateSettings()),
  );
}

describe("normalizeDesktopAppId", () => {
  it.each(["Code.exe", "CODE.EXE", "code.exe", "  Code.exe  "])(
    "normalizes %s to the same app ID",
    (processName) => {
      expect(normalizeDesktopAppId(processName)).toBe("code.exe");
    },
  );

  it("normalizes Unicode to NFC without locale-specific casing", () => {
    expect(normalizeDesktopAppId("  Cafe\u0301.EXE  ")).toBe("café.exe");
  });

  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
    ["leading control character", "\nCode.exe"],
    ["embedded control character", "Code\u0000.exe"],
    ["forward-slash path", "C:/Apps/Code.exe"],
    ["backslash path", "C:\\Apps\\Code.exe"],
  ])("rejects %s processName", (_label, processName) => {
    expect(() => normalizeDesktopAppId(processName)).toThrow();
  });
});

describe("hourly rate settings mutations", () => {
  it("creates deeply immutable version 1 defaults", () => {
    const settings = createDefaultHourlyRateSettings();

    expect(settings).toEqual({
      schemaVersion: 1,
      defaultHourlyRateYen: 0,
      desktopApps: [],
    });
    expect(Object.isFrozen(settings)).toBe(true);
    expect(Object.isFrozen(settings.desktopApps)).toBe(true);
  });

  it("registers only canonical process information with no override", () => {
    const settings = registerDesktopApp(
      "  Cafe\u0301.EXE  ",
      createDefaultHourlyRateSettings(),
    );

    expect(settings.desktopApps).toEqual([
      {
        appId: "café.exe",
        processName: "Café.EXE",
        hourlyRateYen: null,
      },
    ]);
    expect(Object.keys(settings.desktopApps[0]).sort()).toEqual([
      "appId",
      "hourlyRateYen",
      "processName",
    ]);
    expect(Object.isFrozen(settings.desktopApps[0])).toBe(true);
  });

  it("does not duplicate an app when process name casing differs", () => {
    const first = registerDesktopApp("Code.exe", createDefaultHourlyRateSettings());
    const second = registerDesktopApp(" CODE.EXE ", first);

    expect(second.desktopApps).toEqual(first.desktopApps);
    expect(second.desktopApps).toHaveLength(1);
  });

  it("sets zero and fractional default rates", () => {
    const initial = createDefaultHourlyRateSettings();
    const fractional = setDefaultHourlyRateYen(1_234.5, initial);
    const zero = setDefaultHourlyRateYen(0, fractional);

    expect(fractional.defaultHourlyRateYen).toBe(1_234.5);
    expect(zero.defaultHourlyRateYen).toBe(0);
    expect(initial.defaultHourlyRateYen).toBe(0);
  });

  it("sets, changes, and clears an app override", () => {
    const registered = createSettingsWithCode();
    const zeroOverride = setAppHourlyRateYen("CODE.EXE", 0, registered);
    const fractionalOverride = setAppHourlyRateYen(
      "code.exe",
      1_234.5,
      zeroOverride,
    );
    const cleared = clearAppHourlyRateYen("Code.exe", fractionalOverride);

    expect(zeroOverride.desktopApps[0].hourlyRateYen).toBe(0);
    expect(fractionalOverride.desktopApps[0].hourlyRateYen).toBe(1_234.5);
    expect(cleared.desktopApps[0].hourlyRateYen).toBeNull();
    expect(registered.desktopApps[0].hourlyRateYen).toBeNull();
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects invalid rate %s",
    (hourlyRateYen) => {
      const settings = createSettingsWithCode();

      expect(() => setDefaultHourlyRateYen(hourlyRateYen, settings)).toThrow();
      expect(() =>
        setAppHourlyRateYen("Code.exe", hourlyRateYen, settings),
      ).toThrow();
    },
  );

  it("rejects override operations for an unregistered app", () => {
    const settings = createDefaultHourlyRateSettings();

    expect(() => setAppHourlyRateYen("Code.exe", 1_000, settings)).toThrow(
      "desktop app is not registered",
    );
    expect(() => clearAppHourlyRateYen("Code.exe", settings)).toThrow(
      "desktop app is not registered",
    );
  });

  it("does not mutate its input object or arrays", () => {
    const input = {
      schemaVersion: 1,
      defaultHourlyRateYen: 3_000,
      desktopApps: [
        {
          appId: "code.exe",
          processName: "Code.exe",
          hourlyRateYen: null,
        },
      ],
    } as const satisfies HourlyRateSettings;
    const snapshot = structuredClone(input);

    const result = setAppHourlyRateYen("Code.exe", 1_500, input);

    expect(input).toEqual(snapshot);
    expect(result).not.toBe(input);
    expect(result.desktopApps).not.toBe(input.desktopApps);
    expect(result.desktopApps[0]).not.toBe(input.desktopApps[0]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.desktopApps)).toBe(true);
    expect(Object.isFrozen(result.desktopApps[0])).toBe(true);
  });
});

describe("resolveHourlyRateYen", () => {
  it("falls back to default for an unregistered app", () => {
    const settings = setDefaultHourlyRateYen(
      3_000,
      createDefaultHourlyRateSettings(),
    );

    expect(resolveHourlyRateYen("notepad.exe", settings)).toBe(3_000);
  });

  it("falls back to default for a registered app with null override", () => {
    expect(resolveHourlyRateYen("CODE.EXE", createSettingsWithCode())).toBe(3_000);
  });

  it("preserves an explicit zero override", () => {
    const settings = setAppHourlyRateYen("Code.exe", 0, createSettingsWithCode());

    expect(resolveHourlyRateYen("code.exe", settings)).toBe(0);
  });

  it("returns a fractional app override deterministically", () => {
    const settings = setAppHourlyRateYen(
      "Code.exe",
      1_234.5,
      createSettingsWithCode(),
    );

    expect(resolveHourlyRateYen("Code.exe", settings)).toBe(1_234.5);
    expect(resolveHourlyRateYen("CODE.EXE", settings)).toBe(1_234.5);
    expect(resolveHourlyRateYen("code.exe", settings)).toBe(1_234.5);
  });

  it("rejects malformed settings instead of returning an invalid rate", () => {
    const invalidSettings = {
      ...createDefaultHourlyRateSettings(),
      defaultHourlyRateYen: -1,
    } as HourlyRateSettings;

    expect(() => resolveHourlyRateYen("Code.exe", invalidSettings)).toThrow();
  });
});
