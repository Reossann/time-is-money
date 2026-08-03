import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "./App";
import { useNavigationStore } from "./stores/useNavigationStore";

describe("App navigation", () => {
  beforeEach(() => {
    useNavigationStore.setState({ currentPage: "dashboard" });
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
});
