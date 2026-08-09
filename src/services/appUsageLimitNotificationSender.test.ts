import { describe, expect, it } from "vitest";

import { appUsageLimitNotificationMessage } from "./appUsageLimitNotificationSender";

describe("appUsageLimitNotificationMessage", () => {
  it("maps daily events to the agreed Japanese messages", () => {
    expect(appUsageLimitNotificationMessage({ kind: "daily", notification: "remaining-15-minutes" })).toBe("今日の利用時間は残り15分！");
    expect(appUsageLimitNotificationMessage({ kind: "daily", notification: "remaining-5-minutes" })).toBe("今日の利用時間は残り5分！");
    expect(appUsageLimitNotificationMessage({ kind: "daily", notification: "reached" })).toBe("今日の利用時間制限に達しました！");
    expect(appUsageLimitNotificationMessage({ kind: "daily", notification: "exceeded-5-minutes" })).toBe("今日の利用時間制限を5分超過しました！");
    expect(appUsageLimitNotificationMessage({ kind: "daily", notification: "exceeded-15-minutes" })).toBe("今日の利用時間制限を15分超過しました！");
  });

  it("maps continuous events to the agreed Japanese messages", () => {
    expect(appUsageLimitNotificationMessage({ kind: "continuous", notification: "remaining-15-minutes" })).toBe("連続利用時間の制限まで残り15分！");
    expect(appUsageLimitNotificationMessage({ kind: "continuous", notification: "remaining-5-minutes" })).toBe("連続利用時間の制限まで残り5分！");
    expect(appUsageLimitNotificationMessage({ kind: "continuous", notification: "reached" })).toBe("連続利用時間の制限に達しました！");
    expect(appUsageLimitNotificationMessage({ kind: "continuous", notification: "exceeded-5-minutes" })).toBe("連続利用時間の制限を5分超過しました！");
    expect(appUsageLimitNotificationMessage({ kind: "continuous", notification: "exceeded-15-minutes" })).toBe("連続利用時間の制限を15分超過しました！");
  });
});
