import { create } from "zustand";

type ActivityState = {
  elapsedSeconds: number;
  startedAt: number | null;
  startMeasurement: (now?: number) => void;
  syncElapsed: (now?: number) => void;
};

export const useActivityStore = create<ActivityState>((set, get) => ({
  elapsedSeconds: 0,
  startedAt: null,
  startMeasurement: (now = Date.now()) => {
    set({ elapsedSeconds: 0, startedAt: now });
  },
  syncElapsed: (now = Date.now()) => {
    const { startedAt } = get();

    if (startedAt === null) return;

    set({
      elapsedSeconds: Math.max(0, Math.floor((now - startedAt) / 1000)),
    });
  },
}));
