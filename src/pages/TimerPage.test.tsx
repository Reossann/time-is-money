import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { DashboardPage } from "./DashboardPage";
import { useActivityStore } from "../stores/useActivityStore";
import { useWebAppStore } from "../stores/useWebAppStore";

describe("DashboardPage", () => {
  beforeEach(() => {
    useActivityStore.setState({ elapsedSeconds: 0, startedAt: null });
    useWebAppStore.setState({
      currentSession: null,
      usageStats: [],
      webApps: [],
    });
  });

  // HEADのバリデーションテスト
  it("shows a formatter error without triggering a render loop", () => {
    useActivityStore.setState({ elapsedSeconds: -1 });

    render(<DashboardPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "入力値は 0 以上である必要があります",
    );
  });

  // HEADの currentSession テスト
  it("shows the current web app when a session is active", () => {
    useWebAppStore.setState({
      currentSession: {
        id: "session-1",
        webAppId: "google-docs",
        webAppName: "Google Docs",
        startedAt: 1_700_000_000_000,
        endedAt: null,
        durationSeconds: 0,
      },
      usageStats: [],
      webApps: [],
    });

    render(<DashboardPage />);

    expect(screen.getByText("Google Docs")).toBeInTheDocument();
    expect(screen.getByText("セッション計測中")).toBeInTheDocument();
  });

  // マージ元のテストと共通で追加するなら：usageStats の表示テスト
  it("displays web app usage statistics", () => {
    useWebAppStore.setState({
      currentSession: null,
      usageStats: [
        {
          webAppId: "google-docs",
          webAppName: "Google Docs",
          cumulativeSeconds: 3600,
          sessionCount: 2,
        },
      ],
      webApps: [],
    });

    render(<DashboardPage />);

    expect(screen.getByText("Google Docs")).toBeInTheDocument();
    expect(screen.getByText("セッション数: 2")).toBeInTheDocument();
  });
});