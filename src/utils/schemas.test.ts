import { describe, expect, it } from "vitest";

import {
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
} as const;

const validAppSettings = {
  hourlyRate: 3_000,
  notificationThresholdMinutes: 30,
  idleThresholdMinutes: 5,
  notificationsEnabled: true,
} as const;

const validAppRule = {
  id: "rule-1",
  matchType: "process",
  matchValue: "Code.exe",
  category: "productive",
} as const;

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
