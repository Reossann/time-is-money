import { beforeEach, describe, expect, it } from "vitest";

import { RESULT_FLOW_STEPS } from "../constants/resultFlow";
import { useResultFlowStore } from "./useResultFlowStore";

describe("useResultFlowStore", () => {
  beforeEach(() => {
    useResultFlowStore.getState().reset();
  });

  it("starts the preview at the first placeholder step", () => {
    useResultFlowStore.getState().start("preview");

    const state = useResultFlowStore.getState();
    expect(state.status).toBe("active");
    expect(state.mode).toBe("preview");
    expect(state.currentStep).toBe("finalizing");
    expect(Object.values(state.stepStatuses)).toEqual(
      RESULT_FLOW_STEPS.map(() => "placeholder"),
    );
  });

  it("moves through all steps without passing either boundary", () => {
    useResultFlowStore.getState().start("preview");
    useResultFlowStore.getState().previous();
    expect(useResultFlowStore.getState().currentStep).toBe("finalizing");

    for (const expectedStep of RESULT_FLOW_STEPS.slice(1)) {
      useResultFlowStore.getState().next();
      expect(useResultFlowStore.getState().currentStep).toBe(expectedStep);
    }

    useResultFlowStore.getState().next();
    expect(useResultFlowStore.getState().currentStep).toBe("returning-home");

    useResultFlowStore.getState().previous();
    expect(useResultFlowStore.getState().currentStep).toBe("improvement");
  });

  it("marks the current animation as skipped once", () => {
    useResultFlowStore.getState().start("preview");
    useResultFlowStore.getState().skipAnimation();
    useResultFlowStore.getState().skipAnimation();

    expect(useResultFlowStore.getState().skippedAnimations).toEqual([
      "finalizing",
    ]);
  });

  it("completes only from the final step or an explicit full skip", () => {
    useResultFlowStore.getState().start("preview");
    useResultFlowStore.getState().finish();
    expect(useResultFlowStore.getState().status).toBe("active");

    useResultFlowStore.getState().skipAll();
    useResultFlowStore.getState().skipAll();
    expect(useResultFlowStore.getState().status).toBe("completed");

    useResultFlowStore.getState().reset();
    expect(useResultFlowStore.getState()).toMatchObject({
      status: "idle",
      mode: null,
      currentStep: "finalizing",
    });
  });
});
