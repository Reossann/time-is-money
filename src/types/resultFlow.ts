import type { RESULT_FLOW_STEPS } from "../constants/resultFlow";

export type ResultFlowStep = (typeof RESULT_FLOW_STEPS)[number];

export type ResultFlowStatus = "idle" | "active" | "completed";

export type ResultFlowMode = "preview" | "live" | "replay";

export type ResultStepStatus = "placeholder" | "ready";

export type ResultStepStatuses = Readonly<
  Record<ResultFlowStep, ResultStepStatus>
>;

export type ResultFlowPreviewContent = {
  title: string;
  description: string;
  responsibleIssue: string;
};
