import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { useActivityStore } from "./stores/useActivityStore";
import { useNavigationStore } from "./stores/useNavigationStore";

describe("App navigation", () => {
  beforeEach(() => {
    useNavigationStore.setState({ currentPage: "dashboard" });
    useActivityStore.setState({ elapsedSeconds: 0, startedAt: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the dashboard first", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Dashboard" }),
    ).toBeInTheDocument();
  });

  it("shows history after clicking its navigation button", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /History/ }));

    expect(
      screen.getByRole("heading", { level: 2, name: "History" }),
    ).toBeInTheDocument();
  });

  it("updates the displayed app usage time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    render(<App />);

    act(() => {
      vi.advanceTimersByTime(3_500);
    });

    expect(screen.getByText("00:00:03")).toBeInTheDocument();
  });
});
