import { create } from "zustand";

type ActivityState = {
  elapsedSeconds: number;
  isRunning: boolean;
  increment: () => void;
};

export const useActivityStore = create<ActivityState>((set) => ({
  elapsedSeconds: 0,
  isRunning: true,
  increment: () =>
    set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 })),
}));
