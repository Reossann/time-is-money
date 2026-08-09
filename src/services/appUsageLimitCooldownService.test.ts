import { describe, expect, it } from "vitest";

import {
  canDeliverAppUsageLimitNotification,
  recordAppUsageLimitNotificationDelivery,
  resetAppUsageLimitNotificationDelivery,
} from "./appUsageLimitCooldownService";

const notificationKey = "editor:daily:reached" as const;

describe("app usage limit notification cooldown", () => {
  it("allows the first delivery and blocks delivery during cooldown", () => {
    const empty = {};
    expect(canDeliverAppUsageLimitNotification(notificationKey, 100, 900, empty)).toBe(true);
    const recorded = recordAppUsageLimitNotificationDelivery(notificationKey, 100, empty);
    expect(canDeliverAppUsageLimitNotification(notificationKey, 999, 900, recorded)).toBe(false);
    expect(canDeliverAppUsageLimitNotification(notificationKey, 1_000, 900, recorded)).toBe(true);
  });

  it("does not accept invalid time values", () => {
    expect(canDeliverAppUsageLimitNotification(notificationKey, -1, 60, {})).toBe(false);
    expect(canDeliverAppUsageLimitNotification(notificationKey, 1, -1, {})).toBe(false);
    expect(recordAppUsageLimitNotificationDelivery(notificationKey, Number.NaN, {})).toEqual({});
  });

  it("clears delivery history when the local date changes", () => {
    const state = recordAppUsageLimitNotificationDelivery(notificationKey, 100, {});
    expect(resetAppUsageLimitNotificationDelivery(state, false)).toEqual(state);
    expect(resetAppUsageLimitNotificationDelivery(state, true)).toEqual({});
  });
});
