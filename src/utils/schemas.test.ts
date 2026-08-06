import { describe, expect, it } from "vitest";

import type { ActiveWindowInfo, ActivityRecord, AppRule } from "../types/activity";
import type { AppSettings } from "../types/settings";
import {
  activeWindowInfoSchema,
  activityCategorySchema,
  activityRecordSchema,
  appRuleSchema,
  appSettingsSchema,
} from "./schemas";

const validActivityRecord = {
  id: "activity-1",
  processName: "Code.exe",
  windowTitle: "time-is-money",
  category: "productive",
  startedAt: 1_700_000_000,
  endedAt: 1_700_000_300,
  durationSeconds: 300,
  hourlyRate: 3_000,
  calculatedCost: 250,
} as const satisfies ActivityRecord;

const validAppSettings = {
  hourlyRate: 3_000,
  notificationThresholdMinutes: 30,
  idleThresholdMinutes: 5,
  notificationsEnabled: true,
} as const satisfies AppSettings;

const validAppRule = {
  id: "rule-1",
  matchType: "process",
  matchValue: "Code.exe",
  category: "productive",
} as const satisfies AppRule;

const validActiveWindowInfo = {
  processName: "Code.exe",
  windowTitle: "time-is-money",
  processId: 4_242,
} as const satisfies ActiveWindowInfo;

describe("activityRecordSchema", () => {
  it("accepts a valid activity record", () => {
    expect(activityRecordSchema.safeParse(validActivityRecord).success).toBe(true);
  });

  it("accepts a number or null for endedAt", () => {
    expect(
      activityRecordSchema.safeParse({ ...validActivityRecord, endedAt: 100 }).success,
    ).toBe(true);
    expect(
      activityRecordSchema.safeParse({ ...validActivityRecord, endedAt: null }).success,
    ).toBe(true);
  });

  it("rejects a missing required field", () => {
    const recordWithoutId = { ...validActivityRecord };
    Reflect.deleteProperty(recordWithoutId, "id");

    expect(activityRecordSchema.safeParse(recordWithoutId).success).toBe(false);
  });

  it("rejects a field with the wrong type", () => {
    expect(
      activityRecordSchema.safeParse({ ...validActivityRecord, startedAt: "now" }).success,
    ).toBe(false);
  });

  it("rejects snake_case JSON keys", () => {
    expect(
      activityRecordSchema.safeParse({
        id: "activity-1",
        process_name: "Code.exe",
        window_title: "time-is-money",
        category: "productive",
        started_at: 1_700_000_000,
        ended_at: 1_700_000_300,
        duration_seconds: 300,
        hourly_rate: 3_000,
        calculated_cost: 250,
      }).success,
    ).toBe(false);
  });
});

describe("appSettingsSchema", () => {
  it("accepts valid app settings", () => {
    expect(appSettingsSchema.safeParse(validAppSettings).success).toBe(true);
  });

  it("rejects missing or incorrectly typed settings", () => {
    const settingsWithoutHourlyRate = { ...validAppSettings };
    Reflect.deleteProperty(settingsWithoutHourlyRate, "hourlyRate");

    expect(appSettingsSchema.safeParse(settingsWithoutHourlyRate).success).toBe(false);
    expect(
      appSettingsSchema.safeParse({
        ...validAppSettings,
        notificationsEnabled: "yes",
      }).success,
    ).toBe(false);
  });

  it("rejects snake_case JSON keys", () => {
    expect(
      appSettingsSchema.safeParse({
        hourly_rate: 3_000,
        notification_threshold_minutes: 30,
        idle_threshold_minutes: 5,
        notifications_enabled: true,
      }).success,
    ).toBe(false);
  });
});

describe("appRuleSchema", () => {
  it("accepts a valid app rule", () => {
    expect(appRuleSchema.safeParse(validAppRule).success).toBe(true);
  });

  it("rejects snake_case JSON keys", () => {
    expect(
      appRuleSchema.safeParse({
        id: "rule-1",
        match_type: "process",
        match_value: "Code.exe",
        category: "productive",
      }).success,
    ).toBe(false);
  });
});

describe("activeWindowInfoSchema", () => {
  it("accepts valid active window information", () => {
    expect(activeWindowInfoSchema.safeParse(validActiveWindowInfo).success).toBe(true);
  });

  it.each([
    ["an empty process name", { ...validActiveWindowInfo, processName: "" }],
    ["a zero process ID", { ...validActiveWindowInfo, processId: 0 }],
    ["a negative process ID", { ...validActiveWindowInfo, processId: -1 }],
    ["a fractional process ID", { ...validActiveWindowInfo, processId: 1.5 }],
    [
      "a process ID larger than u32",
      { ...validActiveWindowInfo, processId: 0x1_0000_0000 },
    ],
  ])("rejects %s", (_description, payload) => {
    expect(activeWindowInfoSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects snake_case JSON keys", () => {
    expect(
      activeWindowInfoSchema.safeParse({
        process_name: "Code.exe",
        window_title: "time-is-money",
        process_id: 4_242,
      }).success,
    ).toBe(false);
  });
});

describe("defined enum values", () => {
  it.each(["productive", "waste", "neutral"])(
    "accepts the %s activity category",
    (category) => {
      expect(activityCategorySchema.safeParse(category).success).toBe(true);
    },
  );

  it("rejects an undefined activity category", () => {
    expect(activityCategorySchema.safeParse("unknown").success).toBe(false);
  });

  it.each(["process", "title", "domain"] as const)(
    "accepts the %s match type",
    (matchType) => {
      expect(appRuleSchema.safeParse({ ...validAppRule, matchType }).success).toBe(true);
    },
  );

  it("rejects an undefined match type", () => {
    expect(
      appRuleSchema.safeParse({ ...validAppRule, matchType: "unknown" }).success,
    ).toBe(false);
  });
});
