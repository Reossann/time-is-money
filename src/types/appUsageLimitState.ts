export type AppUsageLimitState = Readonly<{
  localDate: string;
  lastCapturedAt: number;
  activeAppId: string | null;
  continuousSeconds: number;
  dailySecondsByAppId: Readonly<Record<string, number>>;
}>;

export type AppUsageObservation = Readonly<{
  localDate: string;
  capturedAt: number;
  appId: string | null;
}>;
