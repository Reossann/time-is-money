import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("test environment", () => {
  it("renders React content in jsdom", () => {
    render(<button type="button">Test button</button>);

    expect(screen.getByRole("button", { name: "Test button" })).toBeInTheDocument();
  });

  it("cleans up the DOM between tests", () => {
    expect(screen.queryByRole("button", { name: "Test button" })).not.toBeInTheDocument();
  });
});
