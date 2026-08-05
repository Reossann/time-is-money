import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { DashboardPage } from "./DashboardPage";
import { useActivityStore } from "../stores/useActivityStore";

describe("DashboardPage", () => {
  beforeEach(() => {
    useActivityStore.setState({ elapsedSeconds: 0, startedAt: null });
  });

  it("shows a formatter error without triggering a render loop", () => {
    useActivityStore.setState({ elapsedSeconds: -1 });

    render(<DashboardPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "入力値は 0 以上である必要があります",
    );
  });
});
