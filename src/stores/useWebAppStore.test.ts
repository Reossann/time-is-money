import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWebAppStore } from "./useWebAppStore";
import type { WebApp } from "../types/activity";

const googleDocs: WebApp = {
  id: "google-docs",
  name: "Google Docs",
  url: "https://docs.google.com/document/d/example",
  domain: "docs.google.com",
};

const googleSheets: WebApp = {
  id: "google-sheets",
  name: "Google Sheets",
  url: "https://docs.google.com/spreadsheets/d/example",
  domain: "docs.google.com",
};

describe("useWebAppStore", () => {
  beforeEach(() => {
    useWebAppStore.setState({
      currentSession: null,
      usageStats: [],
      webApps: [],
    });
    vi.restoreAllMocks();
  });

  it("starts a new session and initializes sessionCount to 1", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);

    useWebAppStore.getState().setCurrentWebApp(googleDocs);

    const state = useWebAppStore.getState();

    expect(state.currentSession?.webAppId).toBe("google-docs");
    expect(state.currentSession?.endedAt).toBeNull();
    expect(state.usageStats).toEqual([
      {
        webAppId: "google-docs",
        webAppName: "Google Docs",
        cumulativeSeconds: 0,
        sessionCount: 1,
      },
    ]);
  });

  it("does not create a new session when the same web app is received repeatedly", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);

    useWebAppStore.getState().setCurrentWebApp(googleDocs);
    const firstSessionId = useWebAppStore.getState().currentSession?.id;

    useWebAppStore.getState().setCurrentWebApp(googleDocs);

    const state = useWebAppStore.getState();

    expect(state.currentSession?.id).toBe(firstSessionId);
    expect(state.usageStats).toEqual([
      {
        webAppId: "google-docs",
        webAppName: "Google Docs",
        cumulativeSeconds: 0,
        sessionCount: 1,
      },
    ]);
  });

  it("ends the current session and increments the next web app sessionCount", () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValueOnce(1_000).mockReturnValueOnce(4_000).mockReturnValue(4_000);

    useWebAppStore.getState().setCurrentWebApp(googleDocs);
    useWebAppStore.getState().setCurrentWebApp(googleSheets);

    const state = useWebAppStore.getState();

    expect(state.currentSession?.webAppId).toBe("google-sheets");
    expect(state.usageStats).toEqual([
      {
        webAppId: "google-docs",
        webAppName: "Google Docs",
        cumulativeSeconds: 3,
        sessionCount: 1,
      },
      {
        webAppId: "google-sheets",
        webAppName: "Google Sheets",
        cumulativeSeconds: 0,
        sessionCount: 1,
      },
    ]);
  });
});
