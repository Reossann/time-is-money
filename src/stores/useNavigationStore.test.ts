import { beforeEach, describe, expect, it } from "vitest";

import { useNavigationStore } from "./useNavigationStore";

describe("useNavigationStore", () => {
  beforeEach(() => {
    useNavigationStore.setState({ currentPage: "timer" });
  });

  it("starts on the timer page", () => {
    expect(useNavigationStore.getState().currentPage).toBe("timer");
  });

  it("changes the current page", () => {
    useNavigationStore.getState().setCurrentPage("calendar");

    expect(useNavigationStore.getState().currentPage).toBe("calendar");
  });
});
