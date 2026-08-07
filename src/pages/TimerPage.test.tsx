import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { TimerPage } from "./TimerPage";
import { useActivityStore } from "../stores/useActivityStore";
import { resetMeasurementTrackingControllerForTests } from "../hooks/useMeasurementTracking";

describe("TimerPage", () => {
  beforeEach(() => {
    resetMeasurementTrackingControllerForTests();
    useActivityStore.setState({ elapsedSeconds: 0, startedAt: null });
  });

  it("shows a formatter error without triggering a render loop", () => {
    useActivityStore.setState({ elapsedSeconds: -1 });

    render(<TimerPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "入力値は 0 以上である必要があります",
    );
  });

  it("shows the Windows app diagnostics in development", () => {
    render(<TimerPage />);

    expect(
      screen.getByRole("region", {
        name: "Windowsアプリ利用時間の開発診断",
      }),
    ).toBeInTheDocument();
  });
});
