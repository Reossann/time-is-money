import { beforeEach, describe, expect, it } from "vitest";

import { useNavigationStore } from "./useNavigationStore";

describe("useNavigationStore", () => {
  beforeEach(() => {
    useNavigationStore.setState({ currentPage: "dashboard" });
  });

  it("starts on the dashboard page", () => {
    expect(useNavigationStore.getState().currentPage).toBe("dashboard");
  });

  it("changes the current page", () => {
    useNavigationStore.getState().setCurrentPage("history");

    expect(useNavigationStore.getState().currentPage).toBe("history");
  });
});
