export type NotificationTone = "sparta" | "gentle";
export type NotificationIntervalMinutes = 15 | 30 | 60 | 120;

export type AppSettings = {
  hourlyRate: number;
  notificationThresholdMinutes: number;
  idleThresholdMinutes: number;
  notificationsEnabled: boolean;
  notificationTone: NotificationTone;
  notificationIntervalMinutes: NotificationIntervalMinutes;
};
