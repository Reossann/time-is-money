import type { SessionResult } from "../../types/sessionResult";

export const validSessionResult = {
  schemaVersion: 1,
  sessionId: "00000000-0000-4000-8000-000000000001",
  startedAt: 1_000,
  endedAt: 10_000,
  durationSeconds: 9,
  trackedDurationSeconds: 8,
  untrackedDurationSeconds: 1,
  apps: [
    {
      appId: "code.exe",
      processName: "Code.exe",
      durationSeconds: 5,
      category: "productive",
      hourlyRateYen: 3_600,
      money: { earnedYen: 5, wastedYen: 0, netYen: 5 },
    },
    {
      appId: "chrome.exe",
      processName: "chrome.exe",
      durationSeconds: 3,
      category: null,
      hourlyRateYen: 1_200.5,
      money: { earnedYen: 0, wastedYen: 0, netYen: 0 },
    },
  ],
  totals: { earnedYen: 5, wastedYen: 0, netYen: 5 },
} as const satisfies SessionResult;
