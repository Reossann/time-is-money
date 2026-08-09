export const APP_USAGE_LIMIT_SCHEMA_VERSION = 1 as const;

export type AppUsageLimitKind = "daily" | "continuous";

export type AppUsageLimitNotification =
  | "remaining-15-minutes"
  | "remaining-5-minutes"
  | "reached"
  | "exceeded-5-minutes"
  | "exceeded-15-minutes";

export type AppUsageLimitNotificationEvent = Readonly<{
  kind: AppUsageLimitKind;
  notification: AppUsageLimitNotification;
  limitSeconds: number;
  usedSeconds: number;
}>;
