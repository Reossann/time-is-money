export type ActivityCategory = "productive" | "waste" | "neutral";

export type ActivityRecord = {
  id: string;
  processName: string;
  windowTitle: string;
  category: ActivityCategory;
  startedAt: number;
  endedAt: number | null;
  durationSeconds: number;
  hourlyRate: number;
  calculatedCost: number;
};

export type AppRule = {
  id: string;
  matchType: "process" | "title" | "domain";
  matchValue: string;
  category: ActivityCategory;
};

export type ActiveWindowInfo = {
  processName: string;
  windowTitle: string;
  processId: number;
};
