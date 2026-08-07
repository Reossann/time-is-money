import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleNativeWebAppEvent } from "./nativeBridgeService";
import { useWebAppStore } from "../stores/useWebAppStore";

describe("handleNativeWebAppEvent", () => {
  beforeEach(() => {
    useWebAppStore.setState({
      currentSession: null,
      usageStats: [],
      webApps: [],
      nativeBridgeStatus: "waiting",
      lastNativeEventAt: null,
    });
    vi.restoreAllMocks();
  });

  it("starts a session for a supported URL", () => {
    vi.spyOn(Date, "now").mockReturnValue(2_000);

    expect(
      handleNativeWebAppEvent({
        type: "URL_CHANGE",
        url: "https://github.com/Reossann/time-is-money",
        timestamp: 1_000,
      }),
    ).toBe(true);

    const state = useWebAppStore.getState();
    expect(state.nativeBridgeStatus).toBe("connected");
    expect(state.currentSession?.webAppId).toBe("web-domain:github.com");
  });

  it("switches the current session for an unknown domain", () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValueOnce(1_000).mockReturnValue(4_000);
    useWebAppStore.getState().setCurrentWebApp({
      id: "web-domain:github.com",
      name: "GitHub",
      url: "https://github.com",
      domain: "github.com",
    });

    handleNativeWebAppEvent({
      type: "URL_CHANGE",
      url: "https://example.com",
      timestamp: 3_000,
    });

    expect(useWebAppStore.getState().currentSession).toMatchObject({
      webAppId: "web-domain:example.com",
      webAppName: "example.com",
      endedAt: null,
    });
  });

  it("ends the current session when Chrome tracking stops", () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValueOnce(1_000).mockReturnValue(4_000);
    useWebAppStore.getState().setCurrentWebApp({
      id: "web-domain:github.com",
      name: "GitHub",
      url: "https://github.com",
      domain: "github.com",
    });

    handleNativeWebAppEvent({
      type: "TRACKING_STOP",
      timestamp: 3_000,
    });

    expect(useWebAppStore.getState().currentSession?.endedAt).toBe(4_000);
  });

  it("rejects invalid bridge data without changing the session", () => {
    expect(handleNativeWebAppEvent({ url: "https://github.com" })).toBe(false);
    expect(useWebAppStore.getState().nativeBridgeStatus).toBe("invalid-event");
    expect(useWebAppStore.getState().currentSession).toBeNull();
  });
});
