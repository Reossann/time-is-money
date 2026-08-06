import { create } from "zustand";

import { RESULT_FLOW_STEPS } from "../constants/resultFlow";
import type {
  ResultFlowMode,
  ResultFlowStatus,
  ResultFlowStep,
  ResultStepStatuses,
} from "../types/resultFlow";

type ResultFlowState = {
  status: ResultFlowStatus;
  mode: ResultFlowMode | null;
  currentStep: ResultFlowStep;
  stepStatuses: ResultStepStatuses;
  skippedAnimations: readonly ResultFlowStep[];
  start: (mode: ResultFlowMode) => void;
  next: () => void;
  previous: () => void;
  skipAnimation: () => void;
  skipAll: () => void;
  finish: () => void;
  reset: () => void;
};

function createPlaceholderStatuses(): ResultStepStatuses {
  return Object.fromEntries(
    RESULT_FLOW_STEPS.map((step) => [step, "placeholder"]),
  ) as ResultStepStatuses;
}

function createIdleState() {
  return {
    status: "idle" as const,
    mode: null,
    currentStep: RESULT_FLOW_STEPS[0],
    stepStatuses: createPlaceholderStatuses(),
    skippedAnimations: [] as readonly ResultFlowStep[],
  };
}

export const useResultFlowStore = create<ResultFlowState>((set, get) => ({
  ...createIdleState(),
  start: (mode) => {
    set({
      status: "active",
      mode,
      currentStep: RESULT_FLOW_STEPS[0],
      stepStatuses: createPlaceholderStatuses(),
      skippedAnimations: [],
    });
  },
  next: () => {
    const { currentStep, status } = get();
    if (status !== "active") return;

    const currentIndex = RESULT_FLOW_STEPS.indexOf(currentStep);
    const nextStep = RESULT_FLOW_STEPS[currentIndex + 1];
    if (nextStep) set({ currentStep: nextStep });
  },
  previous: () => {
    const { currentStep, status } = get();
    if (status !== "active") return;

    const currentIndex = RESULT_FLOW_STEPS.indexOf(currentStep);
    const previousStep = RESULT_FLOW_STEPS[currentIndex - 1];
    if (previousStep) set({ currentStep: previousStep });
  },
  skipAnimation: () => {
    const { currentStep, skippedAnimations, status } = get();
    if (status !== "active" || skippedAnimations.includes(currentStep)) return;

    set({ skippedAnimations: [...skippedAnimations, currentStep] });
  },
  skipAll: () => {
    if (get().status === "active") set({ status: "completed" });
  },
  finish: () => {
    const { currentStep, status } = get();
    if (
      status === "active" &&
      currentStep === RESULT_FLOW_STEPS[RESULT_FLOW_STEPS.length - 1]
    ) {
      set({ status: "completed" });
    }
  },
  reset: () => set(createIdleState()),
}));
